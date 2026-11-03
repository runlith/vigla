import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping';
import { expect, inject, onTestFinished, test } from 'vitest';
import type { Target } from '../../../src/target.ts';

const source = `<script lang="ts" module>
class Example {
  private get value() {
    return this.id + 1;
  }
  constructor(public id: number) {}
  read() { return this.value; }
}
const sample = new Example(41);
const result = sample.read();
</script>
<p>{result}</p>
<style>
p { color: red; }
</style>`;

test('preprocessed styles map imported and component declarations', async () => {
	const target: Target = inject('target');
	const home = join(target.root, 'vite-plugin');
	const require = createRequire(join(home, 'package.json'));
	const vite = (await import(pathToFileURL(require.resolve('vite')).href)) as typeof import('vite');
	const plugin = (await import(pathToFileURL(require.resolve('@sveltejs/vite-plugin-svelte')).href)) as typeof import('@vigla/vite-plugin-svelte');
	const work = join(home, '.work');
	await mkdir(work, { recursive: true });
	const root = await mkdtemp(join(work, 'style-map-'));
	onTestFinished(() => rm(root, { recursive: true, force: true }));
	await writeFile(join(root, 'package.json'), JSON.stringify({ type: 'module', dependencies: { svelte: '*', vite: '*' } }));
	await writeFile(join(root, 'App.svelte'), '<div id="test">red</div>\n<div class="foo">magenta</div>\n<style lang="scss">\n@use "./foo";\n#test {\n  & {\n    color: red;\n  }\n}\n</style>');
	await writeFile(join(root, 'foo.scss'), '.foo {\n  color: magenta;\n}\n');
	const server = await vite.createServer({
		root,
		configFile: false,
		logLevel: 'silent',
		css: { devSourcemap: true },
		server: { middlewareMode: true, watch: null, hmr: false },
		plugins: plugin.svelte({ configFile: false, preprocess: plugin.vitePreprocess() })
	});
	try {
		await server.transformRequest('/App.svelte');
		const result = await server.transformRequest('/App.svelte?svelte&type=style&lang.css');
		const literal = result!.code.match(/^const __vite__css = (.*)$/m);
		expect(literal).toBeTruthy();
		const css = JSON.parse(literal![1]!) as string;
		const encoded = css.match(/sourceMappingURL=data:application\/json;base64,([\w+/=]+)/);
		expect(encoded).toBeTruthy();
		const map = JSON.parse(Buffer.from(encoded![1]!, 'base64').toString('utf8'));
		expect(map.sources).toEqual(['foo.scss', 'App.svelte']);
		const lines = css.split('\n');
		for (const [declaration, source, line, column] of [
			['color: magenta', 'foo.scss', 2, 2],
			['color: red', 'App.svelte', 7, 4]
		] as const) {
			const generated = lines.findIndex((value) => value.includes(declaration));
			expect(generated).toBeGreaterThanOrEqual(0);
			const position = originalPositionFor(new TraceMap(map), {
				line: generated + 1,
				column: lines[generated]!.indexOf(declaration)
			});
			expect({ source: position.source, line: position.line, column: position.column }).toEqual({ source, line, column });
		}
	} finally {
		await server.close();
	}
});

test('preprocessed component maps generated code to its original lines', async () => {
	const target: Target = inject('target');
	const home = join(target.root, 'vite-plugin');
	const require = createRequire(join(home, 'package.json'));
	const vite = (await import(pathToFileURL(require.resolve('vite')).href)) as typeof import('vite');
	const plugin = (await import(pathToFileURL(require.resolve('@sveltejs/vite-plugin-svelte')).href)) as typeof import('@vigla/vite-plugin-svelte');
	const work = join(home, '.work');
	await mkdir(work, { recursive: true });
	const root = await mkdtemp(join(work, 'mapping-'));
	onTestFinished(() => rm(root, { recursive: true, force: true }));
	await writeFile(join(root, 'package.json'), JSON.stringify({ type: 'module', dependencies: { svelte: '*', vite: '*' } }));
	await writeFile(join(root, 'App.svelte'), source);
	const server = await vite.createServer({
		root,
		configFile: false,
		logLevel: 'silent',
		appType: 'custom',
		css: { devSourcemap: true },
		server: { middlewareMode: true, watch: null, hmr: { port: 0 } },
		plugins: plugin.svelte({ configFile: false, preprocess: plugin.vitePreprocess({ script: true }) })
	});
	try {
		const result = await server.transformRequest('/App.svelte');
		expect(result?.map).toBeTruthy();
		const map = new TraceMap(result!.map!);
		const lines = result!.code.split('\n');
		for (const marker of ['this.id + 1', 'this.value', 'new Example(41)', 'sample.read()']) {
			const line = lines.findIndex((value) => value.includes(marker));
			expect(line, marker).toBeGreaterThanOrEqual(0);
			const position = originalPositionFor(map, { line: line + 1, column: lines[line]!.indexOf(marker) });
			expect(position.line, marker).toBe(source.split('\n').findIndex((value) => value.includes(marker)) + 1);
		}
		const css = await server.transformRequest('/App.svelte?svelte&type=style&lang.css');
		const literal = css?.code.match(/^const __vite__css = (.*)$/m);
		expect(literal).toBeTruthy();
		const cssText = JSON.parse(literal![1]!) as string;
		const encoded = cssText.match(/sourceMappingURL=data:application\/json;base64,([\w+/=]+)/);
		expect(encoded).toBeTruthy();
		const cssMap = JSON.parse(Buffer.from(encoded![1]!, 'base64').toString('utf8'));
		const cssLines = cssText.split('\n');
		const cssLine = cssLines.findIndex((value) => value.includes('color: red'));
		expect(cssLine).toBeGreaterThanOrEqual(0);
		const position = originalPositionFor(new TraceMap(cssMap), {
			line: cssLine + 1,
			column: cssLines[cssLine]!.indexOf('color: red')
		});
		expect(position.line).toBe(source.split('\n').findIndex((value) => value.includes('color: red')) + 1);
	} finally {
		await server.close();
	}
});
