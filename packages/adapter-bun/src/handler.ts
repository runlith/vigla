import { AsyncLocalStorage } from 'node:async_hooks';
import path from 'node:path';
import type { Server } from '@vigla/kit';
import type { Server as BunServer, Serve } from 'bun';
import type { ServerOptions } from './index.ts';
import { Environment } from './env.ts';
import { staticRoutes, type FileAsset, type Redirect } from './static.ts';

const scope = new AsyncLocalStorage();

export interface Deployment {
	directory: string;
	embedded: boolean;
	envPrefix: string;
	origin?: string;
	serverOptions: ServerOptions;
	files: FileAsset[];
	reads: Array<[string, string]>;
	redirects: Redirect[];
}

export interface Application {
	env: Environment;
	deployment: Deployment;
	routes: Serve.Routes<undefined, string>;
	fetch(request: Request, server: BunServer<undefined>): Promise<Response>;
}

export async function createHandler(server: Server, deployment: Deployment): Promise<Application> {
	const env = new Environment(Bun.env, deployment.envPrefix);
	const addressHeader = env.get('ADDRESS_HEADER', '')!.toLowerCase();
	const protocolHeader = env.get('PROTOCOL_HEADER', '')!.toLowerCase();
	const hostHeader = env.get('HOST_HEADER', '')!.toLowerCase();
	const portHeader = env.get('PORT_HEADER', '')!.toLowerCase();
	const depth = env.integer('XFF_DEPTH', 1, 1)!;
	const origin = env.get('ORIGIN', deployment.origin);
	const reads = new Map(
		deployment.reads.map(([file, source]) => [
			file,
			Bun.file(deployment.embedded ? source : path.join(deployment.directory, source))
		])
	);
	const read = (file: string) => reads.get(file)?.stream() ?? null;
	await server.init({ env: Bun.env, scope, read });
	return {
		env,
		deployment,
		routes: staticRoutes(deployment),
		async fetch(request, host) {
			let normalized: Request;
			try {
				const url = new URL(request.url);
				let publicOrigin = origin;
				if (!publicOrigin) {
					const protocol = decodeURIComponent(
						(protocolHeader && request.headers.get(protocolHeader)) || 'https'
					);
					const authority =
						(hostHeader && request.headers.get(hostHeader)) ||
						(request.headers.get('host') ?? url.host);
					const port = portHeader ? request.headers.get(portHeader) : null;
					if (!/^https?$/i.test(protocol) || !authority || (port && !/^\d+$/.test(port)))
						throw new Error('Invalid request origin');
					publicOrigin = new URL(`${protocol}://${authority}${port ? ':' + port : ''}`).origin;
				}
				normalized =
					publicOrigin === url.origin
						? request
						: new Request(publicOrigin + url.pathname + url.search, request);
			} catch {
				return new Response('Bad Request', { status: 400 });
			}
			const result = await server.respond(normalized, {
				read,
				platform: { server: host },
				getClientAddress: () => {
					if (!addressHeader) return host.requestIP(request)?.address!;
					const value = request.headers.get(addressHeader);
					if (value === null)
						throw new Error(`Missing ${addressHeader} specified by ${env.prefix}ADDRESS_HEADER`);
					if (addressHeader !== 'x-forwarded-for') return value;
					const addresses = value.split(',');
					if (depth > addresses.length)
						throw new Error(`Invalid ${env.prefix}XFF_DEPTH for ${addresses.length} addresses`);
					return addresses[addresses.length - depth]!.trim();
				}
			});
			if (result.headers.get('content-type')?.startsWith('text/event-stream')) {
				host.timeout(request, 0);
				result.headers.set('x-accel-buffering', 'no');
			}
			return result;
		}
	};
}
