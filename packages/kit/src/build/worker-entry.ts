import { existsSync } from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createReadableStream } from '../node/index.ts';
import type {
	RequestStore,
	ServerInstance,
	ServerManifest,
	ServerOptions
} from '../types/internal/server.ts';
import { prerender_fallback_failed } from './messages.ts';
import type { FallbackJob, FallbackResult } from './worker.ts';

interface ServerModule {
	Server: new (manifest: ServerManifest) => ServerInstance;
	options: ServerOptions;
}

async function fallback(job: FallbackJob): Promise<string> {
	const directory = path.join(job.directory, 'server');
	const module = (await import(
		pathToFileURL(path.join(directory, 'index.js')).href
	)) as ServerModule;
	const { manifest } = (await import(
		pathToFileURL(path.join(directory, 'manifest-full.js')).href
	)) as { manifest: ServerManifest };
	module.options.building = true;
	module.options.prerendering = true;
	const server = new module.Server(manifest);
	const read = (file: string) => {
		const name = path.join(directory, file);
		return existsSync(name) ? createReadableStream(name) : null;
	};
	await server.init({ env: job.environment, read, scope: new AsyncLocalStorage<RequestStore>() });
	const response = await server.respond(new Request(job.origin + '/[fallback]'), {
		getClientAddress() {
			throw new Error('Cannot read client address while prerendering');
		},
		prerendering: { fallback: true, insideReroute: false, dependencies: new Map() },
		read: (file) => {
			const name = path.join(job.assets, file);
			return existsSync(name) ? createReadableStream(name) : null;
		}
	});
	if (!response.ok) prerender_fallback_failed();
	return response.text();
}

process.once('message', async (job: FallbackJob) => {
	let result: FallbackResult;
	try {
		result = { value: await fallback(job) };
	} catch (cause) {
		const error = cause instanceof Error ? cause : new Error(String(cause));
		result = { error: { message: error.message, stack: error.stack } };
	}
	process.send!(result, () => process.exit(0));
});
