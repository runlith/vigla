import { locator } from '../../front/index.ts';
import { decodeMap } from './decode.ts';
import {
	MappedCode,
	addOffset,
	basenameOf,
	combine,
	slice,
	type Map,
	type Point,
	type Segment,
	type Source
} from './mapped.ts';

export interface Processed {
	code: string;
	map?: string | object;
	dependencies?: string[];
	attributes?: Record<string, string | boolean>;
	toString?: () => string;
}

export type MarkupPreprocessor = (options: {
	content: string;
	filename?: string;
}) => Processed | void | Promise<Processed | void>;

export type Preprocessor = (options: {
	content: string;
	attributes: Record<string, string | boolean>;
	markup: string;
	filename?: string;
}) => Processed | void | Promise<Processed | void>;

export interface PreprocessorGroup {
	name?: string;
	markup?: MarkupPreprocessor;
	style?: Preprocessor;
	script?: Preprocessor;
}

interface Update {
	string?: string;
	map?: Map;
	dependencies?: string[];
}

function pointer(text: string): (offset: number) => Point {
	const locate = locator(text);
	return (offset) => {
		const { line, column } = locate(offset);
		return { line: line - 1, column };
	};
}

class Result implements Source {
	source: string;
	readonly filename: string | undefined;
	readonly basename: string | null;
	readonly maps: Map[] = [];
	readonly dependencies: string[] = [];
	locate: (offset: number) => Point;

	constructor(source: string, filename: string | undefined) {
		this.source = source;
		this.filename = filename;
		this.locate = pointer(source);
		this.basename = filename == null ? null : basenameOf(filename);
	}

	update({ string, map, dependencies }: Update): void {
		if (string != null) {
			this.source = string;
			this.locate = pointer(string);
		}
		if (map) this.maps.unshift(map);
		if (dependencies) this.dependencies.push(...dependencies);
	}

	processed(): Processed {
		const code = this.source;
		return {
			code,
			dependencies: [...new Set(this.dependencies)],
			map: combine(this.basename, this.maps) as unknown as object,
			toString: () => code
		};
	}
}

const dataUri = /data:(?:application|text)\/json;(?:charset[:=]\S+?;)?base64,(\S*)/;
const mappingUrl = '[#@]\\s*sourceMappingURL\\s*=\\s*(\\S*)';
const scriptMapping = new RegExp(`(?://${mappingUrl})|(?:/\\*${mappingUrl}\\s*\\*/)$`);
const styleMapping = new RegExp(`/\\*${mappingUrl}\\s*\\*/$`);

function decodeBase64(data: string): string {
	if (typeof Buffer === 'function') return Buffer.from(data, 'base64').toString();
	const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

function attachedMap(processed: Processed, tag: 'script' | 'style'): void {
	const warn = (message: string): void => {
		const start =
			processed.code.length < 100 ? processed.code : `${processed.code.slice(0, 100)} [...]`;
		console.warn(`warning: ${message}. processed.code = ${JSON.stringify(start)}`);
	};
	processed.code = processed.code.replace(
		tag === 'script' ? scriptMapping : styleMapping,
		(_, first: string | undefined, second: string | undefined) => {
			const url = (tag === 'script' ? first || second : first) as string;
			const data = (url.match(dataUri) ?? [])[1];
			if (data) {
				if (processed.map) {
					warn(
						'Not implemented. Found sourcemap in both processed.code and processed.map. Please update your preprocessor to return only one sourcemap.'
					);
					return '';
				}
				processed.map = decodeBase64(data);
				return '';
			}
			if (!processed.map) {
				warn(
					`Found sourcemap path ${JSON.stringify(url)} in processed.code, but no sourcemap data. Please update your preprocessor to return sourcemap data directly.`
				);
			}
			return '';
		}
	);
}

function contentCode(processed: Processed, location: Point, basename: string | null): MappedCode {
	let map: Map | undefined;
	if (processed.map) {
		map = decodeMap(processed.map);
		if (map?.sources) {
			const index = map.sources.indexOf(basename);
			if (index !== -1) addOffset(map, location, index);
		}
	}
	return MappedCode.processed(processed.code, map);
}

function tagCode(
	processed: Processed,
	tag: 'style' | 'script',
	originalAttributes: string,
	attributes: string,
	source: Source
): MappedCode {
	const originalOpen = `<${tag}${originalAttributes}>`;
	const open = `<${tag}${attributes}>`;
	let openCode: MappedCode;
	if (originalOpen.length !== open.length) {
		const name = `<${tag}`.length;
		const mappings: Segment[][] = [
			[
				[0, 0, 0, 0],
				[name, 0, 0, name]
			]
		];
		const line = open.split('\n').length - 1;
		const column = open.length - (line === 0 ? 0 : open.lastIndexOf('\n')) - 1;
		while (mappings.length <= line) mappings.push([[0, 0, 0, name]]);
		(mappings[line] as Segment[]).push([
			column,
			0,
			originalOpen.split('\n').length - 1,
			originalOpen.length - originalOpen.lastIndexOf('\n') - 1
		]);
		const map = { version: 3, names: [], sources: [source.basename], mappings } as unknown as Map;
		addOffset(map, source.locate(0), 0);
		openCode = MappedCode.processed(open, map);
	} else {
		openCode = MappedCode.source(slice(open, 0, source));
	}
	const closeCode = MappedCode.source(
		slice(`</${tag}>`, originalOpen.length + source.source.length, source)
	);
	attachedMap(processed, tag);
	const content = contentCode(processed, source.locate(originalOpen.length), source.basename);
	return openCode.concat(content).concat(closeCode);
}

const attributePattern = /([\w-$]+\b)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;

function parseAttributes(text: string): Record<string, string | boolean> {
	const attributes: Record<string, string | boolean> = {};
	for (const match of text.matchAll(attributePattern)) {
		const value = match[2] || match[3] || match[4];
		attributes[match[1] as string] = !value || value;
	}
	return attributes;
}

function stringifyAttributes(
	attributes: Record<string, string | boolean> | undefined
): string | undefined {
	if (!attributes) return undefined;
	const value = Object.entries(attributes)
		.map(([key, value]) => (value === true ? key : `${key}="${value}"`))
		.join(' ');
	return value ? ` ${value}` : value;
}

const styleTags =
	/<!--[^]*?-->|<style((?:\s+[^=>'"/\s]+=(?:"[^"]*"|'[^']*'|[^>\s]+)|\s+[^=>'"/\s]+)*\s*)(?:\/>|>([\S\s]*?)<\/style>)/g;
const scriptTags =
	/<!--[^]*?-->|<script((?:\s+[^=>'"/\s]+=(?:"[^"]*"|'[^']*'|[^>\s]+)|\s+[^=>'"/\s]+)*\s*)(?:\/>|>([\S\s]*?)<\/script>)/g;

interface Replacement {
	offset: number;
	length: number;
	code: MappedCode;
}

async function processTag(
	tag: 'style' | 'script',
	preprocessor: Preprocessor,
	source: Source
): Promise<Update> {
	const dependencies: string[] = [];
	const markup = source.source;
	const single = async (
		whole: string,
		attributes = '',
		content = '',
		offset: number
	): Promise<MappedCode> => {
		const unchanged = (): MappedCode => MappedCode.source(slice(whole, offset, source));
		if (!attributes && !content) return unchanged();
		const processed = await preprocessor({
			content: content || '',
			attributes: parseAttributes(attributes || ''),
			markup,
			filename: source.filename
		});
		if (!processed) return unchanged();
		if (processed.dependencies) dependencies.push(...processed.dependencies);
		if (!processed.map && processed.code === content) return unchanged();
		return tagCode(
			processed,
			tag,
			attributes,
			stringifyAttributes(processed.attributes) ?? attributes,
			slice(content, offset, source)
		);
	};

	const pending: Promise<Replacement>[] = [];
	for (const match of markup.matchAll(tag === 'style' ? styleTags : scriptTags)) {
		const offset = match.index;
		pending.push(
			single(match[0], match[1], match[2], offset).then((code) => ({
				offset,
				length: match[0].length,
				code
			}))
		);
	}
	const replacements = await Promise.all(pending);
	const out = new MappedCode();
	let end = 0;
	for (const { offset, length, code } of replacements) {
		out.concat(MappedCode.source(slice(markup.slice(end, offset), end, source))).concat(code);
		end = offset + length;
	}
	out.concat(MappedCode.source(slice(markup.slice(end), end, source)));
	return { string: out.string, map: out.map, dependencies };
}

async function processMarkup(process: MarkupPreprocessor, source: Source): Promise<Update> {
	const processed = await process({ content: source.source, filename: source.filename });
	if (!processed) return {};
	return {
		string: processed.code,
		map: processed.map
			? ((typeof processed.map === 'string' ? JSON.parse(processed.map) : processed.map) as Map)
			: undefined,
		dependencies: processed.dependencies
	};
}

export async function preprocess(
	source: string,
	preprocessor: PreprocessorGroup | PreprocessorGroup[],
	options?: { filename?: string }
): Promise<Processed> {
	const filename =
		(options && options.filename) || (preprocessor as { filename?: string } | undefined)?.filename;
	const groups = preprocessor ? (Array.isArray(preprocessor) ? preprocessor : [preprocessor]) : [];
	const result = new Result(source, filename);
	for (const group of groups) {
		if (group.markup) result.update(await processMarkup(group.markup, result));
		if (group.script) result.update(await processTag('script', group.script, result));
		if (group.style) result.update(await processTag('style', group.style, result));
	}
	return result.processed();
}
