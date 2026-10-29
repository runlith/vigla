import { join } from 'node:path';
import { defineConfig, type ViteUserConfig } from 'vitest/config';
import { root } from './manifest.ts';
import { borrowed, directory, locate, production, resolver } from './resolve.ts';
import { suites } from './suites.ts';
import type { Target } from './target.ts';

function escape(path: string): string {
	return path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const units = suites
	.filter((suite) => suite.kind === 'units')
	.map((suite) => `${join(root, 'samples', suite.project, suite.name)}/`);

const facade = join(root, 'src', 'units', 'vitest.ts');

function scoped(source: string, importer: string | undefined): string | null {
	if (source !== 'vitest' || importer === undefined) return null;
	const compiled = importer.replaceAll('\\', '/').includes('/.work/units-');
	return compiled || units.some((dir) => importer.startsWith(dir)) ? facade : null;
}

const productionSuite = 'suites/svelte/runtime-production.test.ts';
const xhtml = 'suites/svelte/runtime-xhtml.test.ts';
export function harness(target: Target): ViteUserConfig {
	const svelte = locate(target.root, 'svelte');
	const inline = [new RegExp(`^${escape(svelte.root)}/`)];
	return defineConfig({
		root: target.root,
		plugins: [
			resolver(
				target.root,
				{
					'@vigla/harness/helpers': join(root, 'src', 'helpers.ts'),
					'@vigla/harness/sourcemaps': join(root, 'src', 'sourcemaps.ts')
				},
				scoped
			),
			borrowed(join(target.root, '.work'), join(root, 'package.json'))
		],
		test: {
			dir: root,
			setupFiles: [join(root, 'src', 'setup.ts')],
			testTimeout: 30_000,
			provide: { target },
			server: { deps: { inline } },
			projects: [
				{
					extends: true,
					test: {
						name: 'development',
						include: ['suites/**/*.test.ts'],
						exclude: [productionSuite, xhtml]
					}
				},
				{
					extends: true,
					plugins: [production(svelte.root, 'esm-env')],
					test: {
						name: 'production',
						include: [productionSuite],
						environment: 'jsdom',
						server: {
							deps: {
								inline: [...inline, new RegExp(`^${escape(directory(svelte.root, 'esm-env'))}/`)]
							}
						}
					}
				},
				{
					extends: true,
					test: { name: 'xhtml', include: [xhtml], environment: join(root, 'src', 'xhtml.ts') }
				}
			]
		}
	});
}
