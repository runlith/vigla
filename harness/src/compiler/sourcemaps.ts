import { existsSync, readFileSync } from 'node:fs';
import { decode, type SourceMapSegment } from '@jridgewell/sourcemap-codec';
import { getLocator, locate, type Location } from 'locate-character';
import type { CompileOptions, PreprocessorGroup } from 'svelte/compiler';
import { assert } from 'vitest';
import { forced } from '../reference.ts';
import type { Base } from '../runtime/config.ts';
import { compileRecorded } from '../runtime/compile.ts';
import type { Plain } from '../samples.ts';

type Mapping =
	| string
	| {
			idxOriginal?: number;
			idxGenerated?: number;
			str: string;
			strGenerated?: string | null;
			code?: string;
	  };

interface SourceMap {
	sources: string[];
	mappings: string;
}

interface SourcemapConfig extends Base {
	options?: { filename: string };
	preprocess?: PreprocessorGroup | PreprocessorGroup[];
	js_map_sources?: string[];
	css_map_sources?: string[];
	test?: (args: {
		assert: typeof assert;
		input: string;
		map_preprocessed: unknown;
		code_preprocessed: string;
		map_css: unknown;
		code_css: string;
		map_client: unknown;
		code_client: string;
	}) => void;
	client?: Mapping[] | null;
	server?: Mapping[];
	css?: Mapping[] | null;
	preprocessed?: Mapping[] | null;
}

function readMap(file: string): SourceMap {
	return JSON.parse(readFileSync(file, 'utf8')) as SourceMap;
}

function compare(info: string, input: string, output: string, map: SourceMap, entries: Mapping[]) {
	const locateOutput = getLocator(output);

	function findOriginal(str: string, source: string, from = 0): Location {
		const original = locate(source, source.indexOf(str, from));
		if (!original) {
			throw new Error(`Could not find '${str}'${from > 0 ? ` after index ${from}` : ''} in input`);
		}
		return original;
	}

	function findGenerated(str: string, from = 0): Location {
		const generated = locateOutput(output.indexOf(str, from));
		if (!generated) {
			throw new Error(`Could not find '${str}'${from > 0 ? ` after index ${from}` : ''} in output`);
		}
		return generated;
	}

	const decoded = decode(map.mappings);
	for (let line = 0; line < decoded.length; line++) {
		for (const mapping of decoded[line] ?? []) {
			if (mapping.some((value) => value < 0)) {
				throw new Error(
					`Invalid mapping with negative value ${JSON.stringify(mapping)} at line ${line} of the decoded mappings of ${info} sourcemap\n${JSON.stringify(map)}`
				);
			}
		}
	}

	for (const raw of entries) {
		const entry = typeof raw === 'string' ? { str: raw } : raw;
		const str = entry.str;
		const generatedStr = entry.strGenerated ?? str;
		if (entry.strGenerated === null && !output.includes(generatedStr)) continue;

		let generated = findGenerated(generatedStr);
		if (entry.idxGenerated) {
			let i = entry.idxGenerated;
			while (i-- > 0) generated = findGenerated(generatedStr, generated.character + 1);
		}

		const segments: SourceMapSegment[] = decoded[generated.line] ?? [];
		const segment = segments.find((candidate) => candidate[0] === generated.column);
		if (!segment && entry.strGenerated !== null) {
			throw new Error(
				`Could not find segment for '${str}' in sourcemap (${generated.line}:${generated.column})`
			);
		} else if (segment && entry.strGenerated === null) {
			throw new Error(
				`Found segment for '${str}' in sourcemap (${generated.line}:${generated.column}) but should not`
			);
		} else if (!segment) {
			continue;
		}

		const source = entry.code ?? input;
		let original = findOriginal(str, source);
		if (entry.idxOriginal) {
			let i = entry.idxOriginal;
			while (i-- > 0) original = findOriginal(str, source, original.character + 1);
		}

		assert.equal(segment[2], original.line, `mapped line did not match for '${str}'`);
		assert.equal(segment[3], original.column, `mapped column did not match for '${str}'`);

		const generatedEnd = generated.column + generatedStr.length;
		const endSegment = segments.find((candidate) => candidate[0] === generatedEnd);
		if (!endSegment) {
			const last = segments.at(-1)?.[0] ?? 0;
			if (
				last > generatedEnd ||
				!/[\r\n]/.test(output[generated.character + generatedStr.length] ?? '')
			) {
				throw new Error(
					`Could not find end segment for '${str}' in sourcemap (${generated.line}:${generatedEnd})`
				);
			}
			continue;
		}

		assert.equal(endSegment[2], original.line, `mapped line end did not match for '${str}'`);
		assert.equal(
			endSegment[3],
			original.column + str.length,
			`mapped column end did not match for '${str}'`
		);
	}
}

export const sourcemaps: Plain<SourcemapConfig> = {
	run: async ({ cwd, config }, run) => {
		const options: CompileOptions = { rootDir: run, ...forced(config.compileOptions) };
		const preprocessing = { preprocess: config.preprocess, options: config.options };
		await compileRecorded(cwd, 'client', options, { maps: true, preprocessing });
		await compileRecorded(cwd, 'server', options, { maps: true, preprocessing });

		const input = readFileSync(`${cwd}/input.svelte`, 'utf8');
		const client = `${cwd}/_output/client`;

		let mapClient: SourceMap | null = null;
		const codeClient = readFileSync(`${client}/input.svelte.js`, 'utf8');
		if (config.client === null) {
			assert.equal(existsSync(`${client}/input.svelte.js.map`), false, 'Expected no source map');
		} else {
			mapClient = readMap(`${client}/input.svelte.js.map`);
			assert.deepEqual(
				mapClient.sources.slice().sort(),
				(config.js_map_sources || ['../../input.svelte']).sort(),
				'js.map.sources is wrong'
			);
			if (config.client) compare('client', input, codeClient, mapClient, config.client);
		}

		if (config.client || config.server) {
			const server = `${cwd}/_output/server`;
			compare(
				'server',
				input,
				readFileSync(`${server}/input.svelte.js`, 'utf8'),
				readMap(`${server}/input.svelte.js.map`),
				config.server ?? config.client ?? []
			);
		}

		let mapCss: SourceMap | null = null;
		let codeCss = '';
		if (config.css !== undefined) {
			if (config.css === null) {
				assert.equal(existsSync(`${client}/input.svelte.css.map`), false, 'Expected no source map');
			} else {
				codeCss = readFileSync(`${client}/input.svelte.css`, 'utf8');
				mapCss = readMap(`${client}/input.svelte.css.map`);
				assert.deepEqual(
					mapCss.sources.slice().sort(),
					(config.css_map_sources || ['../../input.svelte']).sort(),
					'css.map.sources is wrong'
				);
				compare('css', input, codeCss, mapCss, config.css);
			}
		}

		let mapPreprocessed: SourceMap | null = null;
		let codePreprocessed = '';
		if (config.preprocessed !== undefined) {
			if (config.preprocessed === null) {
				assert.equal(
					existsSync(`${client}/input.preprocessed.svelte.map`),
					false,
					'Expected no source map'
				);
			} else {
				codePreprocessed = readFileSync(`${client}/input.preprocessed.svelte`, 'utf8');
				mapPreprocessed = readMap(`${client}/input.preprocessed.svelte.map`);
				compare('preprocessed', input, codePreprocessed, mapPreprocessed, config.preprocessed);
			}
		}

		config.test?.({
			assert,
			input,
			map_client: mapClient,
			code_client: codeClient,
			map_preprocessed: mapPreprocessed,
			code_preprocessed: codePreprocessed,
			code_css: codeCss,
			map_css: mapCss
		});
	}
};
