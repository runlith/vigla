import { basename } from 'node:path';
import type { Variant } from './runtime/config.ts';

export type Kind =
	| 'runtime'
	| 'hydration'
	| 'ssr'
	| 'browser'
	| 'custom-elements'
	| 'compiler'
	| 'units';

export interface Upstream {
	file: string;
	describe?: string;
	entry(title: string): { sample: string; variant?: Variant } | null;
}

export interface Suite {
	project: 'svelte' | 'own';
	name: string;
	kind: Kind;
	source: string;
	files: readonly string[];
	upstream: readonly Upstream[];
	tests?: readonly string[];
	include?: RegExp;
}

const variant = /^(.*) \((dom|hydrate|ssr|async-ssr)\)$/;

export function entryId(sample: string, variant?: string): string {
	return variant === undefined ? sample : `${sample} (${variant})`;
}

export function suiteId(suite: { project: string; name: string }): string {
	return `${suite.project}/${suite.name}`;
}

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

function compiler(name: string, tests: readonly string[] = []): Suite {
	return {
		project: 'svelte',
		name,
		kind: 'compiler',
		source: `${name}/samples`,
		files: [`${name}.test.ts`],
		upstream: [{ file: `${name}/test.ts`, entry: (title) => ({ sample: title }) }],
		tests
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
	},
	{
		project: 'svelte',
		name: 'css-parse',
		kind: 'units',
		source: 'css-parse.test.ts',
		files: ['css-parse.test.ts'],
		upstream: [{ file: 'css-parse.test.ts', entry: (title) => ({ sample: title }) }]
	},
	{
		project: 'svelte',
		name: 'signals',
		kind: 'units',
		source: 'signals',
		files: ['signals.test.ts'],
		upstream: [{ file: 'signals/test.ts', entry: (title) => ({ sample: title }) }]
	},
	{
		project: 'svelte',
		name: 'store',
		kind: 'units',
		source: 'store',
		files: ['store.test.ts'],
		upstream: [{ file: 'store/test.ts', entry: (title) => ({ sample: title }) }]
	},
	{
		project: 'svelte',
		name: 'units',
		kind: 'units',
		source: '../src',
		files: ['units.test.ts'],
		upstream: [],
		include: /\.test\.ts$/
	},
	compiler('validator', [
		'errors if options.name is illegal',
		'check warning position',
		'warns if options.name is not capitalised',
		'does not warn if options.name begins with non-alphabetic character',
		'errors if namespace is provided but unrecognised'
	]),
	compiler('compiler-errors', ['resets the compiler state including filename']),
	compiler('parser-legacy'),
	compiler('parser-modern', ['Strips BOM from the input']),
	compiler('print'),
	compiler('preprocess'),
	compiler('sourcemaps'),
	compiler('css'),
	{
		project: 'own',
		name: 'vite-plugin',
		kind: 'units',
		source: 'vite-plugin',
		files: ['vite-plugin.test.ts'],
		upstream: []
	},
	{
		project: 'own',
		name: 'runtime',
		kind: 'runtime',
		source: 'runtime/samples',
		files: ['runtime.test.ts'],
		upstream: []
	},
	{
		project: 'own',
		name: 'browser',
		kind: 'browser',
		source: 'browser/samples',
		files: ['browser.test.ts'],
		upstream: []
	}
];

export function unitFile(suite: Suite): string {
	return suite.source.endsWith('.ts') ? basename(suite.source) : 'test.ts';
}

export function entryOfTest(
	suite: Suite,
	ancestors: readonly string[],
	title: string
): { sample: string; variant?: Variant } | null {
	if (suite.kind === 'units') return { sample: [...ancestors, title].join(' > ') };
	if (suite.kind === 'compiler') return { sample: title };
	return entryOf(title);
}

export function suiteNamed(name: string): Suite {
	const suite = suites.find((candidate) => candidate.name === name);
	if (suite === undefined) throw new Error(`no suite ${name}`);
	return suite;
}

export function suiteOfFile(file: string): Suite | undefined {
	const base = file.replaceAll('\\', '/').split('/').at(-1) ?? '';
	return suites.find((suite) => suite.files.includes(base));
}
