import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import {
	compile,
	compileModule,
	preprocess,
	type CompileOptions,
	type CompileResult,
	type PreprocessorGroup
} from 'svelte/compiler';

export type Side = 'client' | 'server';

export interface Preprocessing {
	preprocess?: PreprocessorGroup | PreprocessorGroup[];
	options?: { filename: string };
}

export interface Recording {
	maps: boolean;
	preprocessing?: Preprocessing;
}

interface Source {
	file: string;
	filename: string;
	text: string;
}

function files(root: string, prefix = ''): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
		if (entry.name.startsWith('.')) continue;
		const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
		if (entry.isDirectory()) found.push(...files(root, path));
		else if (entry.isFile()) found.push(path);
	}
	return found;
}

function write(file: string, contents: string): void {
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, contents);
}

function sources(cwd: string, output: string, side: Side, options: CompileOptions): Source[] {
	rmSync(output, { recursive: true, force: true });
	const components: Source[] = [];

	for (const file of files(cwd)) {
		if (file.startsWith('_')) continue;
		const filename = join(cwd, file);
		const text = readFileSync(filename, 'utf8').replace(/\r\n/g, '\n');

		if (file.endsWith('.js')) {
			const out = join(output, file);
			if (file.endsWith('.svelte.js')) {
				const compiled = compileModule(text, {
					filename,
					generate: side,
					dev: options.dev,
					experimental: options.experimental
				});
				write(out, compiled.js.code);
			} else {
				const source = relative(dirname(out), filename).replace(/\\/g, '/');
				let reexport = `export * from '${source}';`;
				if (text.includes('export default')) reexport += `\nexport { default } from '${source}';`;
				write(out, reexport);
			}
			continue;
		}

		if (!file.endsWith('.svelte')) continue;
		if (file.endsWith('.server.svelte') && side !== 'server') continue;
		if (file.endsWith('.client.svelte') && side !== 'client') continue;
		components.push({
			file: file.replace(/\.(client|server)\.svelte$/, '.svelte'),
			filename,
			text
		});
	}
	return components;
}

function compileSource(
	output: string,
	source: Source,
	side: Side,
	options: CompileOptions
): CompileResult {
	const compiled = compile(source.text, {
		outputFilename: join(output, `${source.file}.js`),
		cssOutputFilename: join(output, `${source.file}.css`),
		filename: source.filename,
		...options,
		generate: side
	});
	write(join(output, `${source.file}.js`), compiled.js.code);
	if (compiled.css) write(join(output, `${source.file}.css`), compiled.css.code);
	return compiled;
}

export function compileDirectory(cwd: string, side: Side, options: CompileOptions): void {
	const output = join(cwd, '_output', side);
	for (const source of sources(cwd, output, side, options)) {
		compileSource(output, source, side, options);
	}
}

export async function compileRecorded(
	cwd: string,
	side: Side,
	options: CompileOptions,
	recording: Recording
): Promise<void> {
	const output = join(cwd, '_output', side);
	const { maps, preprocessing } = recording;

	for (const source of sources(cwd, output, side, options)) {
		let own = options;
		let text = source.text;
		const stem = join(output, source.file.slice(0, -'.svelte'.length));

		if (preprocessing?.preprocess) {
			const preprocessed = await preprocess(
				text,
				preprocessing.preprocess,
				preprocessing.options ?? { filename: source.filename }
			);
			text = preprocessed.code;
			own = { ...options, sourcemap: preprocessed.map };
			write(`${stem}.preprocessed.svelte`, text);
			if (maps) {
				write(`${stem}.preprocessed.svelte.map`, JSON.stringify(preprocessed.map, null, '\t'));
			}
		}

		const compiled = compileSource(output, { ...source, text }, side, own);
		const base = join(output, source.file);
		if (maps) write(`${base}.js.map`, JSON.stringify(compiled.js.map, null, '\t'));
		if (compiled.css) {
			write(`${base}.css.json`, JSON.stringify({ hasGlobal: compiled.css.hasGlobal }));
			if (maps) write(`${base}.css.map`, JSON.stringify(compiled.css.map, null, '\t'));
		}
		if (compiled.warnings.length > 0) {
			write(`${base}.warnings.json`, JSON.stringify(compiled.warnings, null, '\t'));
		}
	}
}
