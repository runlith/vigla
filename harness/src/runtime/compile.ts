import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { compile, compileModule, type CompileOptions } from 'svelte/compiler';

export type Side = 'client' | 'server';

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

export function compileDirectory(cwd: string, side: Side, options: CompileOptions): void {
	const output = join(cwd, '_output', side);
	rmSync(output, { recursive: true, force: true });

	for (let file of files(cwd)) {
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
		file = file.replace(/\.(client|server)\.svelte$/, '.svelte');

		const compiled = compile(text, {
			outputFilename: join(output, `${file}.js`),
			cssOutputFilename: join(output, `${file}.css`),
			filename,
			...options,
			generate: side
		});
		write(join(output, `${file}.js`), compiled.js.code);
		if (compiled.css) write(join(output, `${file}.css`), compiled.css.code);
	}
}
