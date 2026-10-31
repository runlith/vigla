import { expect, test } from 'vitest';
import { analyseOptions } from './index.ts';

test('reads declared literal page options and aliases while ignoring later assignments', () => {
	expect(
		analyseOptions(
			'route.ts',
			`
		const render = false;
		export { render as ssr };
		export let csr = true, prerender = 'auto', trailingSlash = 'always';
		csr = false;
		function inner() { let csr = false; }
		export async function load() { return {}; }
	`
		)
	).toEqual({ ssr: false, csr: true, prerender: 'auto', trailingSlash: 'always', load: null });
});

test.each([
	'export const ssr = runtime.ssr;',
	'export const config = { runtime: "edge" };',
	'export const entries = () => [];',
	'export * from "./other";',
	'export\n*\nfrom "./other";',
	'export * as ssr from "./other";',
	'import { ssr } from "./other"; export { ssr };',
	'import ssr from "./other"; export { ssr };',
	'import * as ssr from "./other"; export { ssr };',
	'const { ssr } = { ssr: false }; export { ssr };',
	'export function prerender() {}',
	'export const load = () => ({}); export const ssr = unknown;'
])('marks runtime-dependent options as unknown: %s', (source) => {
	expect(analyseOptions('route.ts', source)).toBeNull();
});

test('ignores unrelated exports and marks load without evaluating its body', () => {
	expect(
		analyseOptions('route.ts', 'export * as other from "./other"; export const _foo = 42;')
	).toEqual({});
	expect(analyseOptions('route.ts', 'export const load = () => { throw new Error(); };')).toEqual({
		load: null
	});
});

test('reports invalid source at the analysis boundary', () => {
	expect(() => analyseOptions('route.ts', 'export const ssr = ;')).toThrow(
		'Failed to statically analyse page options for route.ts'
	);
});
