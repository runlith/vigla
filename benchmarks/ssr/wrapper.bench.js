import { readFileSync, writeFileSync } from 'node:fs';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import { fastest } from '../shared/time.js';

async function component() {
	const source = readFileSync(new URL('./App.svelte', import.meta.url), 'utf8');
	const output = new URL('./App.js', import.meta.url);
	const options = { generate: 'server', runes: true, experimental: { async: true } };
	writeFileSync(output, compile(source, options).js.code);
	return (await import(output.href)).default;
}

export default [
	{
		label: 'wrapper_bench',
		fn: async () => {
			const App = await component();
			for (let i = 0; i < 3; i++) render(App).body;
			return fastest(10, () => {
				for (let i = 0; i < 100; i++) render(App).body;
			});
		}
	}
];
