import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PreviewServer } from 'vite';
import { createReadableStream, getRequest, setResponse } from '../node/index.ts';
import { serveFile, type FileRepresentation } from '../node/static.ts';
import { walk } from '../build/index.ts';
import type { PrerenderedAsset, PrerenderedPage, PrerenderedRedirect } from '../types/builder.ts';
import type { RequestStore, ServerManifest, ServerModule } from '../types/internal/server.ts';
import { outsideBase } from './assets.ts';
import type { Project } from './project.ts';

interface StoredPrerender {
	pages: Array<[string, PrerenderedPage]>;
	assets: Array<[string, PrerenderedAsset]>;
	redirects: Array<[string, PrerenderedRedirect]>;
	paths: string[];
}

export async function configurePreview(
	preview: PreviewServer,
	project: Project
): Promise<() => void> {
	const output = path.join(project.config.outDir, 'output');
	const directory = path.join(output, 'server');
	if (!existsSync(path.join(directory, 'manifest.js')))
		throw new Error(`Server files not found at ${directory}, did you run build first?`);
	const module = (await import(
		pathToFileURL(path.join(directory, 'index.js')).href
	)) as ServerModule;
	const { manifest } = (await import(pathToFileURL(path.join(directory, 'manifest.js')).href)) as {
		manifest: ServerManifest;
	};
	const assetsPrefix = project.config.paths.assets
		? '/_svelte_kit_assets'
		: project.config.paths.base;
	module.options.paths.assets = assetsPrefix;
	const read = (file: string) => {
		const absolute = path.resolve(directory, file);
		return absolute.startsWith(directory + path.sep) && existsSync(absolute)
			? createReadableStream(absolute)
			: null;
	};
	await module.options.env.set(project.environment.values);
	const instrumentation = path.join(directory, 'instrumentation.server.js');
	if (existsSync(instrumentation)) await import(pathToFileURL(instrumentation).href);
	const server = new module.Server(manifest);
	await server.init({
		env: project.environment.values,
		read,
		scope: new AsyncLocalStorage<RequestStore>()
	});
	const stored = JSON.parse(
		readFileSync(path.join(output, 'prerendered.json'), 'utf8')
	) as StoredPrerender;
	const pages = new Map(stored.pages),
		dependencies = new Map(stored.assets),
		redirects = new Map(stored.redirects);
	const client = path.join(output, 'client');
	const clientFiles = new Set(walk(client).filter((file) => !file.startsWith('.vite/')));
	const representations = new Map<string, FileRepresentation>();
	const emulator = await project.config.adapter?.emulate?.();
	function representation(
		root: string,
		file: string,
		type?: string,
		immutable = false
	): FileRepresentation {
		const key = path.join(root, file);
		let value = representations.get(key);
		if (!value) {
			value = {
				file,
				type,
				etag: `"${createHash('sha256').update(readFileSync(key)).digest('base64url')}"`,
				cacheControl: immutable ? 'public,max-age=31536000,immutable' : 'no-cache'
			};
			representations.set(key, value);
		}
		return value;
	}
	return () => {
		for (let index = preview.middlewares.stack.length - 1; index >= 0; index--) {
			const layer = preview.middlewares.stack[index]!;
			if (
				'name' in layer.handle &&
				['viteBaseMiddleware', 'viteAssetMiddleware', 'vitePreviewMiddleware'].includes(
					layer.handle.name
				)
			)
				preview.middlewares.stack.splice(index, 1);
		}
		preview.middlewares.use(async (request, response, next) => {
			try {
				const origin = `${preview.config.preview.https ? 'https' : 'http'}://${request.headers[':authority'] ?? request.headers.host}`;
				const url = new URL(request.originalUrl ?? request.url ?? '/', origin);
				const pathname = decodeURI(url.pathname);
				if (pathname.startsWith(assetsPrefix + '/')) {
					const file = decodeURIComponent(url.pathname.slice(assetsPrefix.length + 1));
					if (
						clientFiles.has(file) &&
						serveFile({
							directory: client,
							pathname: '/' + file,
							request,
							response,
							representation: representation(
								client,
								file,
								undefined,
								file.startsWith(project.config.appDir + '/immutable/')
							)
						})
					)
						return;
				}
				const base = project.config.paths.base;
				if (base && pathname === base) {
					response.writeHead(307, { location: base + '/' + url.search });
					response.end();
					return;
				}
				if (base && !pathname.startsWith(base + '/')) {
					outsideBase(request, response, base);
					return;
				}
				const redirect = redirects.get(pathname);
				if (redirect) {
					response.writeHead(redirect.status, { location: redirect.location });
					response.end();
					return;
				}
				const page = pages.get(pathname);
				if (page) {
					const root = path.join(output, 'prerendered/pages');
					if (
						serveFile({
							directory: root,
							pathname,
							request,
							response,
							representation: representation(root, page.file, 'text/html')
						})
					)
						return;
				}
				const normalized = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname + '/';
				if (pages.has(normalized)) {
					response.writeHead(308, { location: normalized + url.search });
					response.end();
					return;
				}
				const dependency = dependencies.get(pathname);
				if (dependency) {
					const root = path.join(
						output,
						'prerendered',
						pathname.endsWith('/__data.json') ? 'data' : 'dependencies'
					);
					const file = pathname.slice(base.length + 1) || 'index.html';
					if (
						serveFile({
							directory: root,
							pathname,
							request,
							response,
							representation: representation(root, file, dependency.type)
						})
					)
						return;
				}
				const web = (project.config.adapter?.vite?.getRequest ?? getRequest)({
					request,
					response,
					base: origin
				});
				const result = await server.respond(web, {
					getClientAddress: () => {
						if (!request.socket.remoteAddress) throw new Error('Could not determine clientAddress');
						return request.socket.remoteAddress;
					},
					emulator
				});
				(project.config.adapter?.vite?.setResponse ?? setResponse)(response, result);
			} catch (error) {
				next(error);
			}
		});
	};
}
