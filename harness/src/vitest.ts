import { join } from 'node:path';
import { defineConfig, type ViteUserConfig } from 'vitest/config';
import { root } from './manifest.ts';
import { Report } from './report.ts';
import { locate, resolver } from './resolve.ts';
import type { Target } from './target.ts';

function escape(path: string): string {
	return path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function harness(target: Target): ViteUserConfig {
	const svelte = locate(target.root, 'svelte');
	return defineConfig({
		root: target.root,
		plugins: [
			resolver(target.root, { '@dromon/harness/helpers': join(root, 'src', 'helpers.ts') })
		],
		test: {
			dir: root,
			include: ['suites/**/*.test.ts'],
			setupFiles: [join(root, 'src', 'setup.ts')],
			testTimeout: 30_000,
			reporters: ['default', new Report()],
			provide: { target },
			server: { deps: { inline: [new RegExp(`^${escape(svelte.root)}/`)] } }
		}
	});
}
