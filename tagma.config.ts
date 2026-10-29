import { defineConfig, Files, Format, Imports } from '@runlith/tagma/rules';
import { internals, loads, mentions } from './checks/inspections.ts';

export default defineConfig({
	inspections: {
		modules: Imports.modules({
			runtimes: ['node'],
			framework: ['svelte', 'svelte/*', '@runlith/tagma/*'],
			tests: ['.test'],
			files: { exclude: ['harness/samples/**'] }
		}),
		internals: internals(
			{ patterns: ['^svelte/internal(/|$)', '/src/internal/'] },
			{ files: ['harness/src/**/*.ts', 'harness/src/**/*.js', 'harness/suites/**/*.ts'] }
		),
		'core-names-no-svelte': mentions(
			{
				packages: ['svelte'],
				fix: 'Keep what names svelte in @dromon/svelte; the core is reached through its front-end port and published entries.'
			},
			{
				files: [
					'packages/dromon/**/*.ts',
					'packages/dromon/**/*.mts',
					'packages/dromon/**/*.cts',
					'packages/dromon/**/*.tsx',
					'packages/dromon/**/*.js',
					'packages/dromon/**/*.mjs',
					'packages/dromon/**/*.cjs',
					'packages/dromon/**/*.json'
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
					'packages/dromon/src/runtime/**/*.ts',
					'packages/dromon/src/shared/**/*.ts',
					'packages/dromon/src/entries/index.ts',
					'packages/dromon/src/entries/server.ts',
					'packages/dromon/src/entries/internal/*.ts'
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
