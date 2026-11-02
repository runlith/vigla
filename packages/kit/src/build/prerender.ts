import path from 'node:path';
import { uneval } from 'devalue';
import { resolveRoute } from '../shared/routing/index.ts';
import { addDataSuffix, addResolutionSuffix } from '../shared/pathname.ts';
import { escapeHtml } from '../shared/escape.ts';
import { encodeArgument } from '../shared/remote.ts';
import type { RemotePrerenderInternals } from '../types/internal/remote.ts';
import type { PrerenderDependency } from '../types/internal/server.ts';
import { createReadableStream } from '../node/index.ts';
import { crawl } from './crawl.ts';
import { walk, write } from './files.ts';
import type { PolicyReporter, PrerenderJob, PrerenderResult } from './jobs.ts';
import { Queue } from './queue.ts';
import { reader, type Runtime } from './runtime.ts';
import * as e from './messages.ts';

export async function renderShell(
	runtime: Runtime,
	origin: string,
	assets: string
): Promise<string> {
	await runtime.init();
	const response = await runtime.server.respond(new Request(origin + '/[fallback]'), {
		getClientAddress() {
			e.prerender_client_address();
		},
		prerendering: { fallback: true, insideReroute: false, dependencies: new Map() },
		read: reader(assets)
	});
	if (!response.ok) e.prerender_fallback_failed();
	return response.text();
}

export async function prerender(
	job: PrerenderJob,
	runtime: Runtime,
	report: PolicyReporter
): Promise<PrerenderResult> {
	const result: PrerenderResult = {
		prerendered: { pages: new Map(), assets: new Map(), redirects: new Map(), paths: [] },
		prerenderMap: new Map(
			[...job.analysis.routes].map(([id, metadata]) => [id, metadata.prerender])
		)
	};
	const target = path.join(job.directory, 'prerendered');
	if (job.hash) {
		write(
			path.join(target, 'pages/index.html'),
			await renderShell(runtime, job.origin, job.assets)
		);
		result.prerendered.pages.set(job.base + '/', { file: 'index.html' });
		result.prerendered.paths.push(job.base + '/');
		return result;
	}
	const remotePrefix = `/${runtime.manifest.app_path}/remote/`;
	const prerenderFunctions: RemotePrerenderInternals[] = [];
	for (const load of Object.values(runtime.manifest.remotes)) {
		const { default: functions } = await load();
		for (const { __: internals } of Object.values(functions))
			if (internals.type === 'prerender') prerenderFunctions.push(internals);
	}
	if (![...result.prerenderMap.values()].some(Boolean) && !prerenderFunctions.length) return result;
	await runtime.init();
	const remoteEntries: string[] = [];
	const { transport } = await runtime.options.getHooks();
	for (const internals of prerenderFunctions) {
		const inputs = (await internals.inputs?.()) ?? [];
		if (internals.has_arg)
			for (const input of inputs)
				remoteEntries.push(remotePrefix + internals.id + '/' + encodeArgument(input, transport));
		else remoteEntries.push(remotePrefix + internals.id);
	}
	const remoteResponses = new Map<string, Promise<any>>();
	const saved = new Map<string, string>();
	const emitted = reader(path.join(job.directory, 'server'));
	const assets = reader(job.assets);
	const queue = new Queue(job.concurrency);
	const known = new Set(walk(path.join(job.directory, 'client')));
	known.add(runtime.manifest.app_dir + '/env.js');
	const seen = new Set<string>();
	const written = new Set<string>();
	const visitedRoutes = new Set<string>();
	const ids = new Map<string, Set<string>>();
	const fragments = new Map<string, Map<string, Set<string>>>();
	const origin = new URL(job.origin).origin;
	function filename(pathname: string, html: boolean): string {
		const file = pathname.slice(job.base.length + 1) || 'index.html';
		return html && !file.endsWith('.html')
			? file + (file.endsWith('/') ? 'index.html' : '.html')
			: file;
	}
	async function save(
		url: URL,
		response: Response,
		body: Uint8Array,
		referrer: string | null,
		expected?: string,
		referenceType: 'linked' | 'fetched' = 'linked'
	): Promise<void> {
		const pathname = decodeURI(url.pathname);
		const encoded = response.headers.get('x-sveltekit-routeid');
		const id = encoded ? decodeURI(encoded) : null;
		if (expected && id !== expected)
			await report({
				kind: 'handleEntryGeneratorMismatch',
				details: {
					generatedFromId: expected,
					entry: pathname,
					matchedId: id ?? pathname,
					message: e.prerender_entry_generator_mismatch(expected, pathname, id ?? pathname)
				}
			});
		if (id) visitedRoutes.add(id);
		if (response.status === 204) return;
		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get('location');
			if (!location) {
				e.prerender_redirect_location_missing({ path: pathname });
				return;
			}
			const resolved = new URL(location, url);
			enqueue(resolved.href, pathname);
			if (response.headers.has('x-sveltekit-normalize')) return;
			enqueueData(url, pathname, id);
			if (!result.prerendered.paths.includes(pathname)) result.prerendered.paths.push(pathname);
			result.prerendered.redirects.set(pathname, {
				status: response.status,
				location:
					resolved.origin === url.origin
						? resolved.pathname + resolved.search + resolved.hash
						: location
			});
			const file = filename(pathname, true);
			if (!written.has(file)) {
				write(
					path.join(target, 'pages', file),
					`<script>location.href=${uneval(location)};</script><meta http-equiv="refresh" content="${escapeHtml(`0;url=${location}`, true)}">`
				);
				written.add(file);
			}
			return;
		}
		if (response.status !== 200) {
			await report({
				kind: 'handleHttpError',
				details: {
					status: response.status,
					path: pathname,
					referrer,
					referenceType,
					message: e.prerender_http_error(response.status, pathname, referrer, referenceType)
				}
			});
			return;
		}
		const type = response.headers.get('content-type') ?? 'application/octet-stream';
		const html = type.split(';')[0] === 'text/html';
		if (!html && pathname.slice(job.base.length + 1) === '')
			e.prerender_root_non_html({ base: job.base || '/' });
		const file = filename(pathname, html);
		const category = html
			? 'pages'
			: pathname.startsWith(remotePrefix) || pathname.endsWith('/__data.json')
				? 'data'
				: 'dependencies';
		const destination = path.resolve(target, category, file);
		if (!destination.startsWith(path.resolve(target, category) + path.sep))
			throw new Error(`Prerender path escapes its output: ${pathname}`);
		if (!written.has(file)) {
			write(destination, body);
			written.add(file);
			saved.set(file, destination);
			runtime.manifest.assets.add(file);
			if (html) result.prerendered.pages.set(pathname, { file });
			else result.prerendered.assets.set(pathname, { type });
		}
		if (!result.prerendered.paths.includes(pathname)) result.prerendered.paths.push(pathname);
		if (html) {
			const found = crawl(new TextDecoder().decode(body), url.href);
			ids.set(pathname, new Set(found.ids));
			for (const href of found.invalid)
				await report({
					kind: 'handleInvalidUrl',
					details: {
						href,
						referrer: pathname,
						message: e.prerender_invalid_url(href, pathname)
					}
				});
			if (job.crawl) for (const href of found.hrefs) enqueue(href, pathname);
			enqueueData(url, pathname, id);
			if (runtime.manifest.client?.routes) {
				enqueue(addResolutionSuffix(url.pathname), pathname);
				if (id)
					enqueue(
						addResolutionSuffix(
							`${job.base}/${runtime.manifest.app_dir}/routes${id === '/' ? '' : id}`
						),
						pathname
					);
			}
		}
	}
	function enqueueData(url: URL, pathname: string, id: string | null): void {
		const route = runtime.manifest.routes.find((route) => route.id === id);
		if (
			route?.page &&
			[...route.page.layouts, route.page.leaf].some(
				(index) => index !== undefined && job.analysis.nodes[index]?.hasServerLoad
			)
		)
			enqueue(addDataSuffix(url.pathname), pathname);
	}
	async function visit(url: URL, referrer: string | null, expected?: string): Promise<void> {
		const dependencies = new Map<string, PrerenderDependency>();
		const response = await runtime.server.respond(new Request(url), {
			getClientAddress() {
				e.prerender_client_address();
			},
			prerendering: { fallback: false, insideReroute: false, dependencies, remoteResponses },
			emulator: runtime.emulator,
			read: (file) =>
				saved.has(file)
					? createReadableStream(saved.get(file)!)
					: file.startsWith(`${runtime.manifest.app_dir}/`)
						? emitted(file)
						: assets(file)
		});
		await save(url, response, new Uint8Array(await response.arrayBuffer()), referrer, expected);
		for (const [href, dependency] of dependencies) {
			const destination = new URL(href, url);
			const prerender = dependency.response.headers.get('x-sveltekit-prerender');
			const encoded = dependency.response.headers.get('x-sveltekit-routeid');
			if (prerender && encoded !== null) {
				const id = decodeURI(encoded);
				if (result.prerenderMap.get(id) !== 'auto')
					result.prerenderMap.set(id, prerender === 'true' ? true : 'auto');
			}
			const body =
				dependency.body === null
					? new Uint8Array(await dependency.response.arrayBuffer())
					: typeof dependency.body === 'string'
						? new TextEncoder().encode(dependency.body)
						: dependency.body;
			await save(destination, dependency.response, body, url.pathname, undefined, 'fetched');
		}
	}
	function enqueue(href: string, referrer: string | null, expected?: string): void {
		let url: URL;
		try {
			url = new URL(href, job.origin);
		} catch {
			void queue.add(() =>
				report({
					kind: 'handleInvalidUrl',
					details: { href, referrer, message: e.prerender_invalid_url(href, referrer) }
				})
			);
			return;
		}
		if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) return;
		const pathname = decodeURI(url.pathname);
		if (url.hash && referrer) {
			const fragment = decodeURI(url.hash.slice(1));
			if (fragment && fragment.toLowerCase() !== 'top') {
				const targets = fragments.get(pathname) ?? new Map<string, Set<string>>();
				const references = targets.get(fragment) ?? new Set<string>();
				references.add(referrer);
				targets.set(fragment, references);
				fragments.set(pathname, targets);
			}
		}
		if (known.has(pathname.slice(job.base.length + 1))) return;
		url.hash = '';
		url.search = '';
		if (seen.has(url.href)) return;
		seen.add(url.href);
		void queue.add(async () => {
			if (job.base && pathname !== job.base && !pathname.startsWith(job.base + '/')) {
				await report({
					kind: 'handleHttpError',
					details: {
						status: 404,
						path: pathname,
						referrer,
						referenceType: 'linked',
						message: e.prerender_http_error(404, pathname, referrer, 'linked')
					}
				});
				return;
			}
			await visit(url, referrer, expected);
		});
	}
	for (const entry of job.entries) {
		if (entry !== '*') {
			enqueue(job.base + entry, null);
			continue;
		}
		for (const [id, metadata] of job.analysis.routes) {
			if (!metadata.prerender) continue;
			const params = runtime.manifest.routes.find((route) => route.id === id)?.params ?? [];
			if (params.every((param) => param.optional)) enqueue(job.base + resolveRoute(id, {}), null);
		}
	}
	for (const [id, metadata] of job.analysis.routes)
		if (metadata.prerender)
			for (const entry of metadata.entries ?? []) enqueue(job.base + entry, null, id);
	for (const entry of remoteEntries) enqueue(entry, null);
	await queue.done();
	for (const [pathname, targets] of fragments) {
		const found = ids.get(pathname);
		if (!found) continue;
		for (const [id, referrers] of targets)
			if (!found.has(id))
				await report({
					kind: 'handleMissingId',
					details: {
						path: pathname,
						id,
						referrers: [...referrers],
						message: e.prerender_missing_id(pathname, id, [...referrers])
					}
				});
	}
	const unseen = [...job.analysis.routes]
		.filter(([id, metadata]) => metadata.prerender === true && !visitedRoutes.has(id))
		.map(([id]) => id);
	if (unseen.length)
		await report({
			kind: 'handleUnseenRoutes',
			details: {
				routes: unseen,
				message: e.prerender_unseen_routes(unseen)
			}
		});
	result.prerendered.paths.sort();
	return result;
}
