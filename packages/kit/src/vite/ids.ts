import path from 'node:path';
import { codeDirectory, posix } from './paths.ts';
import { hash } from '../shared/hash.ts';
import type { ResolvedConfig } from 'vite';
import type { ValidatedConfig } from '../types/builder.ts';
import type { Project } from './project.ts';

export function namespace(version: string, dev: boolean): string {
	return dev ? '__sveltekit_dev' : `__sveltekit_${hash(version)}`;
}
export const virtualDirectory = `${posix(codeDirectory)}vite/__generated__/`;
export const ids = {
	server: `${virtualDirectory}server.js`,
	manifest: `${virtualDirectory}manifest.js`,
	appManifest: `${virtualDirectory}app-manifest.js`,
	options: `${virtualDirectory}options.js`,
	client: `${virtualDirectory}client/app.js`,
	bundle: `${virtualDirectory}client/bundle.js`,
	bootstrap: `${virtualDirectory}client/bootstrap.js`,
	errorTemplate: `${virtualDirectory}error-template.js`,
	root: `${virtualDirectory}components/root.js`,
	layout: `${virtualDirectory}components/layout.js`,
	error: `${virtualDirectory}components/error.js`,
	env: `${virtualDirectory}env/config.js`,
	workerEnv: `${virtualDirectory}env/service-worker.js`,
	publicEnv: `${virtualDirectory}env/public.js`,
	privateEnv: `${virtualDirectory}env/private.js`
};

export function clientDirectory(config: ValidatedConfig, vite: ResolvedConfig): string {
	return posix(
		path.join(config.outDir, 'generated', vite.command === 'serve' ? 'dev' : 'build', 'client')
	);
}

export function nodeId(project: Project, index: number): string {
	return `${clientDirectory(project.config, project.vite)}/nodes/${index}.js`;
}
