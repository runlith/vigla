import { existsSync, statSync } from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import { loadConfig } from '../config/file.ts';
import type { Emulator } from '../types/builder.ts';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createReadableStream } from '../node/index.ts';
import type {
	ConfiguredServer,
	Environment,
	Read,
	RequestStore,
	ServerInstance,
	ServerInternalModule,
	ServerManifest,
	ServerModule,
	ServerOptions
} from '../types/internal/server.ts';
import type { PrerenderJob, WorkerPlatform } from './jobs.ts';

export interface Runtime {
	server: ServerInstance | ConfiguredServer;
	manifest: ServerManifest;
	options: ServerOptions;
	environment: Environment;
	read: Read;
	emulator?: Emulator;
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

export async function loadEmulator(job: PrerenderJob): Promise<Emulator | undefined> {
	if (!job.configFile) return;
	const { config } = await loadConfig(job.root, job.configFile, job.mode);
	return config.adapter?.emulate?.();
}

export async function loadRuntime(job: WorkerPlatform, prerendering: boolean): Promise<Runtime> {
	const directory = path.join(job.directory, 'server');
	const module = (await import(
		pathToFileURL(path.join(directory, 'index.js')).href
	)) as ServerModule;
	const { manifest } = (await import(
		pathToFileURL(path.join(directory, 'manifest-full.js')).href
	)) as { manifest: ServerManifest };
	const read = reader(directory);
	const server = await module.configure({
		manifest,
		building: true,
		prerendering,
		env: job.environment,
		read,
		scope: new AsyncLocalStorage<RequestStore>()
	});
	await server.init();
	const { options } = (await import(
		pathToFileURL(path.join(directory, 'internal.js')).href
	)) as ServerInternalModule;
	const { environment } = (await import(pathToFileURL(path.join(directory, 'env.js')).href)) as {
		environment: Environment;
	};
	return { server, manifest, options, environment, read };
}
