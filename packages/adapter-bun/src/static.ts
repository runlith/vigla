import path from 'node:path';
import type { Serve } from 'bun';

export interface FileAsset {
	source: string;
	url: string;
	aliases: string[];
	canonical?: string;
	hidden: boolean;
	hash: string;
	mtime: number;
	type: string;
	immutable: boolean;
	br: boolean;
	gz: boolean;
}

export interface Redirect {
	url: string;
	status: number;
	location: string;
}

export interface StaticFiles {
	directory: string;
	embedded: boolean;
	files: FileAsset[];
	redirects: Redirect[];
}

type Routes = Serve.Routes<undefined, string>;

function serialize(url: string): string {
	return url.replace(/[\u0000-\u001f\u007f-\u{10ffff} "#<>?`{}%\\]/gu, (char) =>
		encodeURIComponent(char)
	);
}

function spellings(url: string): string[] {
	return [...new Set([serialize(url), url.split('/').map(encodeURIComponent).join('/')])];
}

export function staticRoutes(deployment: StaticFiles): Routes {
	const routes: Routes = {};
	const aliases: Array<[string, Routes[string]]> = [];
	const register = (url: string, route: Routes[string]) => {
		for (const spelling of spellings(url)) if (!(spelling in routes)) routes[spelling] = route;
	};
	for (const asset of deployment.files) {
		if (asset.hidden) continue;
		const file = deployment.embedded ? asset.source : path.join(deployment.directory, asset.source);
		const route = { GET: (request: Request) => serve(request, file, asset) };
		register(asset.url, route);
		for (const alias of asset.aliases) aliases.push([alias, route]);
	}
	for (const [alias, route] of aliases) register(alias, route);
	for (const asset of deployment.files)
		if (asset.canonical) {
			const alternate = asset.canonical.endsWith('/')
				? asset.canonical.slice(0, -1)
				: asset.canonical + '/';
			if (alternate)
				register(alternate, {
					GET: (request: Request) =>
						new Response(null, {
							status: 308,
							headers: { location: serialize(asset.canonical!) + new URL(request.url).search }
						})
				});
		}
	for (const redirect of deployment.redirects)
		register(redirect.url, {
			GET: () =>
				new Response(null, { status: redirect.status, headers: { location: redirect.location } })
		});
	return routes;
}

function serve(request: Request, file: string, asset: FileAsset): Response {
	const accepted = new Set<string>();
	for (const part of (request.headers.get('accept-encoding') ?? '').toLowerCase().split(',')) {
		const [coding = '', ...params] = part.trim().split(';');
		if (!params.some((param) => /^q=0(?:\.0*)?$/.test(param.trim()))) accepted.add(coding.trim());
	}
	const encoding = request.headers.has('range')
		? undefined
		: asset.br && (accepted.has('br') || accepted.has('*'))
			? 'br'
			: asset.gz && (accepted.has('gzip') || accepted.has('*'))
				? 'gz'
				: undefined;
	const etag = `"${asset.hash}${encoding ? '-' + encoding : ''}"`;
	const headers = new Headers({
		etag,
		'last-modified': new Date(asset.mtime).toUTCString(),
		'content-type': asset.type
	});
	if (asset.immutable) headers.set('cache-control', 'public,max-age=31536000,immutable');
	if (asset.br || asset.gz) headers.set('vary', 'accept-encoding');
	const none = request.headers.get('if-none-match');
	const since = Date.parse(request.headers.get('if-modified-since') ?? '');
	const fresh =
		none !== null
			? none.split(',').some((tag) => ['*', etag].includes(tag.trim().replace(/^W\//, '')))
			: Number.isFinite(since) && Math.floor(asset.mtime / 1000) <= Math.floor(since / 1000);
	if (fresh) return new Response(null, { status: 304, headers });
	if (encoding) headers.set('content-encoding', encoding === 'gz' ? 'gzip' : 'br');
	return new Response(Bun.file(file + (encoding ? '.' + encoding : '')), { headers });
}
