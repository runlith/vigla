import { existsSync, statSync } from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createReadableStream } from '../node/index.ts';
import type {
	Environment,
	Read,
	RequestStore,
	ServerInstance,
	ServerManifest,
	ServerModule,
	ServerOptions
} from '../types/internal/server.ts';
import type { WorkerPlatform } from './jobs.ts';

export interface Runtime {
	server: ServerInstance;
	manifest: ServerManifest;
	options: ServerOptions;
	environment: Environment;
	read: Read;
}

export function reader(directory: string): Read {
	return (file) => {
		const absolute = path.resolve(directory, file);
		if (
			!absolute.startsWith(path.resolve(directory) + path.sep) ||
			!existsSync(absolute) ||
			!statSync(absolute).isFile()
		)
			return null;
		return createReadableStream(absolute);
	};
}

export async function loadRuntime(job: WorkerPlatform, prerendering: boolean): Promise<Runtime> {
	const directory = path.join(job.directory, 'server');
	const module = (await import(
		pathToFileURL(path.join(directory, 'index.js')).href
	)) as ServerModule;
	const { manifest } = (await import(
		pathToFileURL(path.join(directory, 'manifest-full.js')).href
	)) as { manifest: ServerManifest };
	module.options.building = true;
	module.options.prerendering = prerendering;
	const server = new module.Server(manifest);
	const read = reader(directory);
	await server.init({ env: job.environment, read, scope: new AsyncLocalStorage<RequestStore>() });
	const { environment } = (await import(pathToFileURL(path.join(directory, 'env.js')).href)) as {
		environment: Environment;
	};
	return { server, manifest, options: module.options, environment, read };
}
