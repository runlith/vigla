import { defineConfig, Files, Format, Imports } from '@tagmahq/tagma/rules';
import { builtins, internals, loads, words } from './checks/inspections.ts';

export default defineConfig({
	inspections: {
		modules: Imports.modules({
			runtimes: ['node', 'bun'],
			framework: ['svelte', 'svelte/*', '@tagmahq/tagma/*', '$app/*'],
			tests: ['.test'],
			files: { exclude: ['harness/samples/**'] }
		}),
		internals: internals(
			{ patterns: ['^svelte/internal(/|$)', '/src/internal/'] },
			{ files: ['harness/src/**/*.ts', 'harness/src/**/*.js', 'harness/suites/**/*.ts'] }
		),
		'products-name-no-svelte': words(
			{
				words: ['svelte'],
				tests: ['.test.', '.spec.'],
				fix: 'Give the thing its own name here; a name of Svelte or SvelteKit is supplied by the compatibility package that needs it — @vigla/svelte, @vigla/vite-plugin-svelte or @vigla/sveltekit.'
			},
			{
				files: [
					'packages/vigla/**/*.{ts,mts,cts,tsx,js,mjs,cjs,json,md}',
					'packages/vite-plugin/**/*.{ts,mts,cts,tsx,js,mjs,cjs,json,md}',
					'packages/kit/**/*.{ts,mts,cts,tsx,js,mjs,cjs,json,md}',
					'packages/adapter-*/**/*.{ts,mts,cts,tsx,js,mjs,cjs,json,md}'
				]
			}
		),
		size: Files.maxLines(600, {
			files: {
				exclude: [
					...Files.tests,
					'**/*.d.ts',
					'harness/samples/**',
					'packages/svelte/src/front/parse/entities.ts'
				]
			}
		}),
		'runtime-loads': loads(
			{
				allows: ['clsx', 'devalue', 'esm-env'],
				fix: 'Move what needs the package to the compiler side, or reach it through clsx, devalue or esm-env.'
			},
			{
				files: [
					'packages/vigla/src/runtime/**/*.ts',
					'packages/vigla/src/shared/**/*.ts',
					'packages/vigla/src/entries/index.ts',
					'packages/vigla/src/entries/server.ts',
					'packages/vigla/src/entries/internal/*.ts'
				]
			}
		),
		'kit-web-only': builtins(
			{
				globals: [
					'process',
					'Buffer',
					'require',
					'global',
					'__dirname',
					'__filename',
					'getBuiltinModule',
					'setImmediate'
				],
				tests: ['.test.', '.spec.'],
				fix: 'Take what the platform gives through Server.init or the request options, and leave Node glue to kit-node, kit-vite, kit-build or an adapter.'
			},
			{
				files: [
					'packages/kit/src/server/**/*.ts',
					'packages/kit/src/client/**/*.ts',
					'packages/kit/src/shared/**/*.ts',
					'packages/kit/src/types/**/*.ts',
					'packages/kit/src/entries/**/*.ts'
				]
			}
		)
	},
	format: {
		oxfmt: Format.command({
			run: ['node_modules/.bin/oxfmt', '--no-error-on-unmatched-pattern'],
			files: [
				'**/*.{ts,js,mjs,json,md}',
				'!harness/samples/**',
				'!harness/manifest/**',
				'!.tagma/**'
			],
			reads: 'nearby'
		})
	}
});
