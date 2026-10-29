import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { flushSync, mount, unmount, type Component } from 'svelte';
import type { CompileOptions, Warning } from 'svelte/compiler';
import { assert } from 'vitest';
import { htmlEqual } from '../html.ts';
import { forced } from '../reference.ts';
import type { Base } from '../runtime/config.ts';
import { compileRecorded } from '../runtime/compile.ts';
import type { Plain } from '../samples.ts';
import { readOptional } from './diagnostics.ts';

interface CssConfig extends Base {
	warnings?: Warning[];
	props?: Record<string, unknown>;
	hasGlobal?: boolean;
}

function normalize(warning: Warning): Warning {
	const copy: Partial<Warning> = { ...warning };
	delete copy.filename;
	delete copy.position;
	delete copy.frame;
	const lines = warning.message.split('\n');
	if (lines.at(-1)?.startsWith('https://svelte.dev/e/')) lines.pop();
	return { ...copy, message: lines.join('\n') } as Warning;
}

function warningsOf(path: string): Warning[] {
	if (!existsSync(path)) return [];
	return (JSON.parse(readFileSync(path, 'utf8')) as Warning[]).map(normalize);
}

export const css: Plain<CssConfig> = {
	run: async ({ cwd, config }, run) => {
		const options: CompileOptions = {
			rootDir: run,
			cssHash: () => 'svelte-xyz',
			...forced(config.compileOptions)
		};
		await compileRecorded(cwd, 'client', options, { maps: false });
		await compileRecorded(cwd, 'server', options, { maps: false });

		const expected = {
			html: readOptional(`${cwd}/expected.html`),
			css: readOptional(`${cwd}/expected.css`)
		};

		const client = (await import(`${cwd}/_output/client/input.svelte.js`)) as {
			default: Component<Record<string, unknown>>;
		};
		await import(`${cwd}/_output/server/input.svelte.js`);

		if (expected.html !== null) {
			const target = window.document.createElement('main');
			const component = mount(client.default, { props: config.props ?? {}, target });
			flushSync();
			const html = target.innerHTML;
			writeFileSync(`${cwd}/_output/rendered.html`, html);
			htmlEqual(html, expected.html);
			void unmount(component);
			window.document.head.innerHTML = '';
		}

		if (config.hasGlobal !== undefined) {
			const metadata = JSON.parse(
				readFileSync(`${cwd}/_output/client/input.svelte.css.json`, 'utf8')
			) as { hasGlobal: boolean };
			assert.equal(metadata.hasGlobal, config.hasGlobal);
		}

		const domCss = readFileSync(`${cwd}/_output/client/input.svelte.css`, 'utf8').trim();
		const ssrCss = readFileSync(`${cwd}/_output/server/input.svelte.css`, 'utf8').trim();
		assert.equal(domCss, ssrCss);

		const domWarnings = warningsOf(`${cwd}/_output/client/input.svelte.warnings.json`);
		const ssrWarnings = warningsOf(`${cwd}/_output/server/input.svelte.warnings.json`);
		assert.deepEqual(domWarnings, ssrWarnings);
		assert.deepEqual(domWarnings, (config.warnings || []).map(normalize));

		assert.equal(domCss.trim().replace(/\r\n/g, '\n'), (expected.css ?? '').trim());
	}
};
