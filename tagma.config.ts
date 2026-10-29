import { defineConfig, Format, Imports } from '@runlith/tagma/rules';
import { internals } from './checks/inspections.ts';

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
