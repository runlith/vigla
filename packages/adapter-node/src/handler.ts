import { AsyncLocalStorage } from 'node:async_hooks';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Server } from '@vigla/kit';
import { createReadableStream, getRequest, setResponse } from '@vigla/kit/node';
import { serveFile } from '@vigla/kit/internal/node';
import type { Asset } from './assets.ts';
import { Environment } from './env.ts';

export type Handler = (
	request: IncomingMessage,
	response: ServerResponse,
	next?: () => void
) => Promise<void>;

export interface Deployment {
	directory: string;
	base: string;
	appPath: string;
	origin?: string;
	mimeTypes: Record<string, string>;
	assets: Asset[];
}

export async function createHandler(
	server: Server,
	deployment: Deployment,
	env: Environment
): Promise<Handler> {
	const origin = env.get('ORIGIN', deployment.origin);
	const addressHeader = env.get('ADDRESS_HEADER', '')!.toLowerCase();
	const protocolHeader = env.get('PROTOCOL_HEADER', '')!.toLowerCase();
	const hostHeader = env.get('HOST_HEADER', '')!.toLowerCase();
	const portHeader = env.get('PORT_HEADER', '')!.toLowerCase();
	const depth = env.integer('XFF_DEPTH', 1)!;
	const limit = env.bytes('BODY_SIZE_LIMIT', '512K');
	const read = (file: string) =>
		createReadableStream(path.join(deployment.directory, 'client' + deployment.base, file));
	await server.init({ env: env.values, read, scope: new AsyncLocalStorage() });
	const files = new Map<string, Asset | string>();
	for (const asset of deployment.assets) if (!files.has(asset.url)) files.set(asset.url, asset);
	for (const asset of deployment.assets)
		for (const alias of asset.aliases) if (!files.has(alias)) files.set(alias, asset);
	for (const asset of deployment.assets)
		if (asset.canonical) {
			const alternate = asset.canonical.endsWith('/')
				? asset.canonical.slice(0, -1)
				: asset.canonical + '/';
			if (alternate && !files.has(alternate)) files.set(alternate, asset.canonical);
		}
	return async (request, response) => {
		const raw = request.url ?? '/';
		const query = raw.indexOf('?');
		let pathname = query < 0 ? raw : raw.slice(0, query);
		const search = query < 0 ? '' : raw.slice(query);
		try {
			pathname = pathname.split('%25').map(decodeURI).join('%25');
		} catch {}
		const asset = files.get(pathname);
		if (asset) {
			if (request.method !== 'GET' && request.method !== 'HEAD') {
				response.writeHead(405, { allow: 'GET, HEAD' }).end();
				return;
			}
			if (typeof asset === 'string') {
				const segment = asset.replace(/\/$/, '').split('/').at(-1);
				const location = pathname.endsWith('/') ? `../${segment}` : `./${segment}/`;
				response.writeHead(308, { location: encodeURI(location) + search }).end();
				return;
			}
			const variant = encoding(request.headers['accept-encoding'], asset);
			if (
				serveFile({
					directory: path.join(deployment.directory, asset.directory + deployment.base),
					pathname,
					request,
					response,
					representation: {
						file: asset.file + (variant ? '.' + variant : ''),
						etag: `"${asset.etag}${variant ? '.' + variant : ''}"`,
						type: deployment.mimeTypes[path.extname(asset.file)],
						cacheControl: asset.url.startsWith(`/${deployment.appPath}/immutable/`)
							? 'public,max-age=31536000,immutable'
							: undefined,
						encoding: variant === 'gz' ? 'gzip' : variant,
						vary: asset.br || asset.gz ? 'Accept-Encoding' : undefined
					}
				})
			)
				return;
		}
		let web: Request;
		try {
			const header = (name: string) => {
				const value = name ? request.headers[name] : undefined;
				if (Array.isArray(value) && value.length > 1) throw new Error(`Multiple ${name} headers`);
				return Array.isArray(value) ? value[0] : value;
			};
			let base = origin;
			if (!base) {
				const protocol = decodeURIComponent(header(protocolHeader) || 'https');
				const host = header(hostHeader) || header('host');
				const port = header(portHeader);
				if (!/^https?$/i.test(protocol) || !host || (port && !/^\d+$/.test(port)))
					throw new Error('Invalid request origin');
				base = new URL(`${protocol}://${host}${port ? ':' + port : ''}`).origin;
			}
			web = getRequest({ base, request, response, bodySizeLimit: limit });
		} catch {
			response.writeHead(400).end('Bad Request');
			return;
		}
		const result = await server.respond(web, {
			read,
			platform: { req: request },
			getClientAddress: () => {
				if (!addressHeader) return request.socket.remoteAddress!;
				const value = request.headers[addressHeader];
				if (value === undefined)
					throw new Error(`Missing ${addressHeader} specified by ${env.prefix}ADDRESS_HEADER`);
				const text = Array.isArray(value) ? value.join(',') : value;
				if (addressHeader !== 'x-forwarded-for') return text;
				const addresses = text.split(',');
				if (depth < 1 || depth > addresses.length)
					throw new Error(`Invalid ${env.prefix}XFF_DEPTH for ${addresses.length} addresses`);
				return addresses[addresses.length - depth]!.trim();
			}
		});
		if (result.headers.get('content-type')?.startsWith('text/event-stream'))
			result.headers.set('x-accel-buffering', 'no');
		setResponse(response, result);
	};
}

function encoding(header: string | undefined, asset: Asset): 'br' | 'gz' | undefined {
	const weights = new Map<string, number>();
	for (const part of header?.toLowerCase().split(',') ?? []) {
		const [name = '', ...params] = part.split(';');
		const q = params.find((param) => param.trim().startsWith('q='));
		weights.set(name.trim(), q ? Number(q.trim().slice(2)) || 0 : 1);
	}
	const br = asset.br ? (weights.get('br') ?? weights.get('*') ?? 0) : 0;
	const gz = asset.gz ? (weights.get('gzip') ?? weights.get('*') ?? 0) : 0;
	return gz > br ? 'gz' : br > 0 ? 'br' : undefined;
}
