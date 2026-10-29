import type { Variant } from './runtime/config.ts';

export type Kind = 'runtime' | 'hydration' | 'ssr' | 'browser' | 'custom-elements' | 'units';

export interface Upstream {
	file: string;
	describe?: string;
	entry(title: string): { sample: string; variant?: Variant } | null;
}

export interface Suite {
	project: 'svelte';
	name: string;
	kind: Kind;
	source: string;
	files: readonly string[];
	upstream: readonly Upstream[];
}

const variant = /^(.*) \((dom|hydrate|ssr|async-ssr)\)$/;

export function entryOf(title: string): { sample: string; variant: Variant } | null {
	const match = variant.exec(title);
	return match === null ? null : { sample: match[1] ?? '', variant: match[2] as Variant };
}

function runtime(name: string): Suite {
	return {
		project: 'svelte',
		name,
		kind: 'runtime',
		source: `${name}/samples`,
		files: [`${name}.test.ts`],
		upstream: [{ file: `${name}/test.ts`, entry: entryOf }]
	};
}

export const suites: readonly Suite[] = [
	runtime('runtime-runes'),
	runtime('runtime-production'),
	runtime('runtime-xhtml'),
	{
		project: 'svelte',
		name: 'hydration',
		kind: 'hydration',
		source: 'hydration/samples',
		files: ['hydration.test.ts'],
		upstream: [
			{ file: 'hydration/test.ts', entry: (title) => ({ sample: title, variant: 'hydrate' }) }
		]
	},
	{
		project: 'svelte',
		name: 'server-side-rendering',
		kind: 'ssr',
		source: 'server-side-rendering/samples',
		files: ['server-side-rendering.test.ts'],
		upstream: [
			{
				file: 'server-side-rendering/test.ts',
				entry: (title) => {
					const match = /^(.*) \((sync|async)\)$/.exec(title);
					if (match === null) return null;
					return { sample: match[1] ?? '', variant: match[2] === 'sync' ? 'ssr' : 'async-ssr' };
				}
			}
		]
	},
	{
		project: 'svelte',
		name: 'runtime-browser',
		kind: 'browser',
		source: 'runtime-browser/samples',
		files: ['runtime-browser.test.ts', 'runtime-browser.ssr.test.ts'],
		upstream: [
			{ file: 'runtime-browser/test.ts', describe: 'runtime-browser', entry: entryOf },
			{
				file: 'runtime-browser/test-ssr.ts',
				entry: (title) => ({ sample: title, variant: 'ssr' })
			}
		]
	},
	{
		project: 'svelte',
		name: 'custom-elements',
		kind: 'custom-elements',
		source: 'runtime-browser/custom-elements-samples',
		files: ['custom-elements.test.ts'],
		upstream: [
			{
				file: 'runtime-browser/test.ts',
				describe: 'custom-elements',
				entry: (title) => ({ sample: title, variant: 'dom' })
			}
		]
	},
	{
		project: 'svelte',
		name: 'motion',
		kind: 'units',
		source: 'motion',
		files: ['motion.test.ts'],
		upstream: [{ file: 'motion/test.ts', entry: (title) => ({ sample: title }) }]
	}
];

export function suiteNamed(name: string): Suite {
	const suite = suites.find((candidate) => candidate.name === name);
	if (suite === undefined) throw new Error(`no suite ${name}`);
	return suite;
}

export function suiteOfFile(file: string): Suite | undefined {
	const base = file.replaceAll('\\', '/').split('/').at(-1) ?? '';
	return suites.find((suite) => suite.files.includes(base));
}
