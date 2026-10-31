import { packageDirectory, posix } from './paths.ts';

export const globalName = '__sveltekit_dev';
export const virtualDirectory = `${posix(packageDirectory)}src/vite/__generated__/`;
export const ids = {
	server: `${virtualDirectory}server.js`,
	manifest: `${virtualDirectory}manifest.js`,
	appManifest: `${virtualDirectory}app-manifest.js`,
	options: `${virtualDirectory}options.js`,
	client: `${virtualDirectory}client/app.js`,
	errorTemplate: `${virtualDirectory}error-template.js`,
	root: `${virtualDirectory}components/root.js`,
	layout: `${virtualDirectory}components/layout.js`,
	error: `${virtualDirectory}components/error.js`,
	env: `${virtualDirectory}env/config.js`,
	workerEnv: `${virtualDirectory}env/service-worker.js`,
	publicEnv: `${virtualDirectory}env/public.js`,
	privateEnv: `${virtualDirectory}env/private.js`
};

export function nodeId(index: number): string {
	return `${virtualDirectory}client/nodes/${index}.js`;
}
