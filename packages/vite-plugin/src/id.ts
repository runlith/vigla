import fs from 'node:fs';
import process from 'node:process';
import { normalizePath } from 'vite';
import type { CompileOptions } from './compiler.ts';
import type { FrontEnd } from './front-end.ts';
import type { Log } from './log.ts';
import { arraify, type ResolvedOptions } from './options.ts';

export const virtualStyle = /[?&]svelte&type=style&lang.css$/;

const fsPrefix = '/@fs/';
const windows = process.platform === 'win32';
const queryCompilerOptions = ['generate', 'dev', 'css', 'customElement', 'immutable'];
const typesWithCompilerOptions = ['style', 'script', 'all'];

export interface RequestQuery {
	url?: boolean;
	raw?: boolean;
	direct?: boolean;
	svelte?: boolean;
	type?: string;
	sourcemap?: boolean;
	compilerOptions?: Partial<CompileOptions>;
	[name: string]: unknown;
}

export interface ModuleRequest {
	id: string;
	filename: string;
	normalizedFilename: string;
	query: RequestQuery;
	timestamp: number;
	ssr: boolean;
	frontEnd: FrontEnd;
}

export interface ComponentRequest extends ModuleRequest {
	cssId: string;
	raw: boolean;
}

export interface IdFilter {
	id: { include: (string | RegExp)[]; exclude: (string | RegExp)[] };
}

export type IdParser = (
	id: string,
	ssr: boolean,
	timestamp?: number
) => ComponentRequest | undefined;
export type ModuleIdParser = (
	id: string,
	ssr: boolean,
	timestamp?: number
) => ModuleRequest | undefined;

function split(id: string): { filename: string; rawQuery: string } {
	const [filename = '', rawQuery = ''] = id.split('?', 2);
	return { filename, rawQuery };
}

function parseQuery(rawQuery: string, log: Log): RequestQuery {
	const query: Record<string, unknown> = Object.fromEntries(new URLSearchParams(rawQuery));
	for (const key in query) if (query[key] === '') query[key] = true;
	const given = query.compilerOptions;
	if (typeof given === 'string') {
		if (!((query.raw || query.direct) && typesWithCompilerOptions.includes(String(query.type)))) {
			throw new Error(
				`Invalid compilerOptions in query ${rawQuery}. CompilerOptions are only supported for raw or direct queries with type in "${typesWithCompilerOptions.join(', ')}" e.g. '?svelte&raw&type=script&compilerOptions={"generate":"server","dev":false}`
			);
		}
		try {
			const parsed = JSON.parse(given) as Record<string, unknown>;
			const invalid = Object.keys(parsed).filter((key) => !queryCompilerOptions.includes(key));
			if (invalid.length > 0) {
				throw new Error(
					`Invalid compilerOptions in query ${rawQuery}: ${invalid.join(', ')}. Supported: ${queryCompilerOptions.join(', ')}`
				);
			}
			query.compilerOptions = parsed;
		} catch (error) {
			log.error('failed to parse request query compilerOptions', error);
			throw error;
		}
	}
	return query as RequestQuery;
}

export function normalize(filename: string, root: string): string {
	const normalized = normalizePath(filename);
	return normalized.startsWith(`${root}/`) ? normalized.slice(root.length) : normalized;
}

function existsInRoot(filename: string, root: string): boolean {
	return !filename.startsWith(fsPrefix) && fs.existsSync(root + filename);
}

function styleId(filename: string, root: string): string {
	let path = filename;
	if (existsInRoot(filename, root)) path = root + filename;
	else if (filename.startsWith(fsPrefix)) {
		path = windows ? filename.slice(fsPrefix.length) : filename.slice(fsPrefix.length - 1);
	}
	return `${path}?svelte&type=style&lang.css`;
}

function escape(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function bare(extension: string): string {
	return escape(extension.startsWith('.') ? extension.slice(1) : extension);
}

function componentPattern(extensions: readonly string[]): RegExp {
	return new RegExp(`^[^?#]+\\.(?:${extensions.map(bare).join('|')})(?:[?#]|$)`);
}

function modulePattern(infixes: readonly string[], extensions: readonly string[]): RegExp {
	return new RegExp(
		`^[^?#]+(?:${infixes.map(escape).join('|')})(?:[^.\\\\/]+\\.)*(?:${extensions.map(bare).join('|')})(?:[?#]|$)`
	);
}

function claims(patterns: readonly RegExp[], frontEnds: readonly FrontEnd[]) {
	return (filename: string): FrontEnd =>
		frontEnds[patterns.findIndex((pattern) => pattern.test(filename))] ??
		(frontEnds[0] as FrontEnd);
}

function componentPatterns(options: ResolvedOptions, frontEnds: readonly FrontEnd[]): RegExp[] {
	return frontEnds.map((frontEnd) =>
		componentPattern(frontEnds.length === 1 ? options.extensions : frontEnd.components)
	);
}

export function buildIdFilter(options: ResolvedOptions, frontEnds: readonly FrontEnd[]): IdFilter {
	return {
		id: {
			include:
				frontEnds.length === 0
					? [/$./]
					: [...componentPatterns(options, frontEnds), ...arraify(options.include)],
			exclude: ['\0', virtualStyle, ...arraify(options.exclude)]
		}
	};
}

export function buildIdParser(
	options: ResolvedOptions,
	frontEnds: readonly FrontEnd[],
	log: Log
): IdParser {
	if (frontEnds.length === 0) return () => undefined;
	const root = normalizePath(options.root);
	const claim = claims(componentPatterns(options, frontEnds), frontEnds);
	return (id, ssr, timestamp = Date.now()) => {
		const { filename, rawQuery } = split(id);
		const query = parseQuery(rawQuery, log);
		const rawOrDirect = !!(query.raw || query.direct);
		if (query.url || (!query.svelte && rawOrDirect)) return undefined;
		return {
			id,
			filename,
			normalizedFilename: normalize(filename, root),
			cssId: styleId(filename, root),
			query,
			timestamp,
			ssr,
			raw: rawOrDirect,
			frontEnd: claim(filename)
		};
	};
}

function modulePatterns(options: ResolvedOptions, frontEnds: readonly FrontEnd[]): RegExp[] {
	const given = frontEnds.length === 1 ? (options.experimental?.compileModule ?? {}) : {};
	return frontEnds.map((frontEnd) =>
		modulePattern(
			given.infixes ?? frontEnd.modules.infixes,
			given.extensions ?? frontEnd.modules.extensions
		)
	);
}

export function buildModuleIdFilter(
	options: ResolvedOptions,
	frontEnds: readonly FrontEnd[]
): IdFilter {
	const given = options.experimental?.compileModule ?? {};
	return {
		id: {
			include:
				frontEnds.length === 0
					? [/$./]
					: [...modulePatterns(options, frontEnds), ...arraify(given.include)],
			exclude: ['\0', ...arraify(given.exclude)]
		}
	};
}

export function buildModuleIdParser(
	options: ResolvedOptions,
	frontEnds: readonly FrontEnd[],
	log: Log
): ModuleIdParser {
	if (frontEnds.length === 0) return () => undefined;
	const root = normalizePath(options.root);
	const claim = claims(modulePatterns(options, frontEnds), frontEnds);
	return (id, ssr, timestamp = Date.now()) => {
		const { filename, rawQuery } = split(id);
		const query = parseQuery(rawQuery, log);
		if (query.url || query.raw || query.direct) return undefined;
		return {
			id,
			filename,
			normalizedFilename: normalize(filename, root),
			query,
			timestamp,
			ssr,
			frontEnd: claim(filename)
		};
	};
}
