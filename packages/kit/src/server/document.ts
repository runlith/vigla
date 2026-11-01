import { render } from 'vigla/server';
import type { Page } from '../types/state.ts';
import type { ParamValue } from '../types/params.ts';
import type { PageNode, RenderBranch, RequestStore, RootProps } from '../types/internal/server.ts';
import type { Server } from './index.ts';
import type { LoadedNode } from './load.ts';
import { escapeHtml, escapeJson } from '../shared/escape.ts';
import { hash } from '../shared/hash.ts';
import { errorGuards } from '../shared/render.ts';
import { Redirect } from '../shared/outcomes.ts';
import { DataSerializer } from './data.ts';
import { Csp } from './csp.ts';
import { handleError } from './failure.ts';
import { requestContext, runRequest } from './scope.ts';
import { stateKey } from './state.ts';
import { clientPath, documentPaths } from './paths.ts';
import { serializeFetched } from './replay.ts';
import { streamText } from './stream.ts';
import { routeObject } from './routing.ts';
import * as errors from './errors.ts';
import * as warnings from './warnings.ts';

export interface PageDocument {
	branch: LoadedNode[];
	errors: Array<PageNode | undefined>;
	status: number;
	error: App.Error | null;
	form: unknown;
	ssr: boolean;
	csr: boolean;
}

export async function renderDocument(
	server: Server,
	store: RequestStore,
	document: PageDocument
): Promise<Response> {
	const { event, state } = store;
	const { options, manifest } = server;
	const prerender = !!state.prerendering || state.prerenderDefault === true;
	if (prerender && options.appTemplateContainsNonce)
		errors.prerender_template_nonce({ tag: '%sveltekit.nonce%' });
	const csp = new Csp(options.csp, prerender, options.dev);
	const data = Object.assign({}, ...document.branch.map((branch) => branch.data));
	const page: Page<Record<string, ParamValue>> = {
		url: event.url,
		params: event.params,
		route: event.route,
		status: document.status,
		error: document.error,
		data,
		state: {},
		shallow: null,
		form: document.form
	};
	let rendered = { head: '', body: '', hashes: { script: [] as readonly string[] } };
	if (document.ssr) {
		let tree: RenderBranch | null = null;
		const merged: Record<string, any> = {};
		const branches: RenderBranch[] = [];
		const guards = errorGuards(
			document.branch.filter((branch) => branch.node.component).map((branch) => branch.depth),
			document.errors
		);
		let index = 0;
		for (const branch of document.branch) {
			Object.assign(merged, branch.data);
			if (!branch.node.component) continue;
			const component = await branch.node.component();
			const guard = guards[index++];
			const error =
				guard === undefined ? null : ((await document.errors[guard]?.component?.()) ?? null);
			branches.push({ component, error, data: { ...merged }, child: null });
		}
		for (let index = branches.length - 1; index >= 0; index--)
			tree = { ...branches[index]!, child: tree };
		if (!tree) throw new Error('A rendered page has no component');
		const props: RootProps = {
			page,
			tree,
			form: document.form,
			error: document.error,
			components: [],
			onerror(error) {
				page.error = error as App.Error;
				page.status = page.error.status;
			}
		};
		const context = requestContext(store);
		context.set(stateKey, page);
		state.isRendering = true;
		try {
			rendered = await server.tracer.span(
				'sveltekit.render',
				{ 'http.route': event.route.id ?? 'unknown' },
				async () =>
					runRequest(
						store,
						() =>
							render(options.root, {
								props,
								context,
								csp: csp.scriptHash ? { hash: true } : { nonce: csp.nonce },
								transformError: async (error) => {
									if (error instanceof Redirect) throw error;
									const body = await handleError(store, error);
									document.error = page.error = body;
									document.status = page.status = body.status;
									return body;
								},
								format: options.format
							}),
						server.scope
					)
			);
		} finally {
			state.isRendering = false;
		}
	}
	csp.scriptHashes(rendered.hashes.script);
	const paths = state.prerendering?.fallback
		? { base: options.paths.base, assets: options.paths.assets || options.paths.base }
		: documentPaths(event.url.pathname, options.paths);
	const head: string[] = [rendered.head];
	let body = rendered.body;
	const headers = new Headers({ 'content-type': 'text/html', 'x-sveltekit-page': 'true' });
	const imports = new Set(manifest.client?.imports ?? []);
	const styles = new Set(manifest.client?.stylesheets ?? []);
	const fonts = new Map((manifest.client?.fonts ?? []).map((font) => [font.file, font]));
	const inlined = new Map<string, string>();
	for (const { node } of document.branch) {
		for (const file of node.imports) imports.add(file);
		for (const file of node.stylesheets) styles.add(file);
		for (const font of node.fonts) fonts.set(font.file, font);
		const inline = await node.inline_styles?.();
		for (const [name, style] of Object.entries(inline ?? {}))
			inlined.set(name, typeof style === 'string' ? style : style(paths.assets, paths.base));
	}
	const preload =
		state.resolveOptions.preload ?? ((file) => file.type === 'js' || file.type === 'css');
	const links: string[] = [];
	const link = (file: string, attributes: string, header: string): void => {
		const path = clientPath(file, paths);
		if (options.output.linkHeaderPreload && !prerender)
			links.push(`<${encodeURI(path)}>; ${header}; nopush`);
		else head.push(`<link href="${escapeHtml(path, true)}" ${attributes}>`);
	};
	for (const file of styles) {
		const path = clientPath(file, paths);
		head.push(
			`<link rel="stylesheet" href="${escapeHtml(path, true)}"${inlined.has(file) ? ' disabled media="(max-width: 0)"' : ''}>`
		);
		if (!inlined.has(file) && options.output.linkHeaderPreload && preload({ type: 'css', path }))
			links.push(`<${encodeURI(path)}>; rel="preload"; as="style"; nopush`);
	}
	for (const css of [
		...inlined.values(),
		...(manifest.client?.inline?.style
			? [manifest.client.inline.style(paths.assets, paths.base)]
			: [])
	]) {
		await csp.style(css);
		head.push(`<style${csp.styleNonce ? ` nonce="${csp.nonce}"` : ''}>${css}</style>`);
	}
	for (const font of fonts.values()) {
		const path = clientPath(font.file, paths);
		if (preload({ type: 'font', path, filename: font.filename }))
			link(
				font.file,
				`rel="preload" as="font" type="font/${font.file.split('.').at(-1)}" crossorigin`,
				'rel="preload"; as="font"; crossorigin'
			);
	}
	if (document.ssr && document.csr)
		body += state.fetched
			.map((fetched) =>
				serializeFetched(
					fetched,
					state.resolveOptions.filterSerializedResponseHeaders ?? (() => false),
					prerender
				)
			)
			.join('');
	const namespace = options.global;
	const serialized = new DataSerializer(server, store, true, namespace).serialize(
		document.branch.map((branch) => branch.server)
	);
	let chunks = serialized.chunks;
	if (!document.csr && chunks && options.dev) warnings.streaming_without_csr();
	if (document.csr && manifest.client) {
		const client = manifest.client;
		for (const file of imports) {
			const path = clientPath(file, paths);
			if (!client.inline && preload({ type: 'js', path })) {
				const relation =
					options.output.preloadStrategy === 'modulepreload'
						? 'rel="modulepreload"'
						: 'rel="preload" as="script" crossorigin';
				link(file, relation, relation.replaceAll(' ', '; '));
			}
		}
		const fallback = !!state.prerendering?.fallback;
		const base = !options.paths.relative
			? escapeJson(paths.base)
			: !fallback
				? `new URL(${escapeJson(paths.base)},location).pathname.slice(0,-1)`
				: options.router.type === 'hash'
					? `new URL('.',location).pathname.slice(0,-1)`
					: escapeJson(paths.base);
		const properties = [
			`base:${base}`,
			`assets:${escapeJson(paths.assets)}`,
			`version:${escapeJson(options.version.name)}`,
			`version_poll_interval:${options.version.pollInterval}`,
			`app_dir:${escapeJson(manifest.app_dir)}`,
			`app_path:${escapeJson(manifest.app_path)}`,
			`embedded:${options.embedded}`,
			`hash:${options.router.type === 'hash'}`
		];
		const eagerEnvironment = client.uses_env_dynamic_public && prerender;
		if (client.uses_env_dynamic_public && !eagerEnvironment)
			properties.push(`env:${uneval(server.environment.rendered)}`);
		const prepare = eagerEnvironment
			? `import(${escapeJson(`${paths.base}/${manifest.app_dir}/env.js`)}).then(({env})=>{${namespace}.env=env;})`
			: 'Promise.resolve()';
		const hydrated = document.ssr
			? `()=>({node_ids:${escapeJson(document.branch.map((branch) => branch.node.index))},data:${serialized.data},form:${inlineValue(document.form, server)},error:${inlineValue(document.error, server)},status:${document.status},params:${uneval(event.params)},route:${escapeJson(event.route)}${
					client.routes?.find((route) => route.id === event.route.id)
						? `,server_route:${routeObject(
								server,
								client.routes.find((route) => route.id === event.route.id)!,
								event.url
							)}`
						: ''
				}})`
			: 'undefined';
		const boot = client.inline
			? `const element=document.currentScript.parentElement;${namespace}.ready=${prepare}.then(()=>{${client.inline.script};${namespace}.app.init?.(${namespace});});${namespace}.ready.then(()=>{const app=${namespace}.app;return app.start(element,${hydrated});});`
			: client.app
				? `const element=document.currentScript.parentElement;const kitPromise=${prepare}.then(()=>import(${escapeJson(clientPath(client.start, paths))}));${namespace}.ready=kitPromise.then(kit=>{kit.init(${namespace});});${namespace}.ready.then(async()=>{const kit=await kitPromise;const app=await import(${escapeJson(clientPath(client.app, paths))});return kit.start(app,element,${hydrated});});`
				: `const element=document.currentScript.parentElement;const appPromise=${prepare}.then(()=>import(${escapeJson(clientPath(client.start, paths))}));${namespace}.ready=appPromise.then(app=>{app.init?.(${namespace});});${namespace}.ready.then(async()=>{const app=await appPromise;return app.start(element,${hydrated});});`;
		const worker = options.serviceWorker;
		const registration = worker
			? `if('serviceWorker' in navigator){const script_url=${escapeJson(clientPath(worker.file, paths))};const policy=globalThis.window?.trustedTypes?.createPolicy('sveltekit-trusted-url',{createScriptURL(url){return url;}});const sanitised=policy?.createScriptURL(script_url)??script_url;addEventListener('load',function(){navigator.serviceWorker.register(sanitised, ${escapeJson({ ...worker.options, type: 'module' })});});}`
			: '';
		const script = `{globalThis.${namespace}={${properties.join(',')}};${boot}${registration}}`;
		await csp.script(script);
		body += `<script${csp.scriptNonce ? ` nonce="${csp.nonce}"` : ''}>${script}</script>`;
	}
	if (chunks) {
		const source = chunks;
		const renderedChunks = async function* (): AsyncGenerator<string> {
			for await (const chunk of source)
				yield `<script${csp.scriptNonce ? ` nonce="${csp.nonce}"` : ''}>${chunk}</script>\n`;
		};
		if (csp.scriptHash) {
			for await (const chunk of source) {
				await csp.script(chunk);
				body += `<script>${chunk}</script>\n`;
			}
			chunks = null;
		} else chunks = renderedChunks();
	}
	if (prerender) head.unshift(csp.meta());
	else csp.apply(headers);
	if (links.length) headers.set('link', links.join(', '));
	const html = options.templates.app({
		head: head.join('\n'),
		body,
		assets: paths.assets,
		nonce: csp.nonce,
		env: server.environment.public
	});
	const transformed = state.resolveOptions.transformPageChunk
		? ((await runRequest(
				store,
				() => state.resolveOptions.transformPageChunk!({ html, done: true }),
				server.scope
			)) ?? '')
		: html;
	if (
		options.dev &&
		document.csr &&
		(transformed.match(/<!--(?!#)/g)?.length ?? 0) < (html.match(/<!--(?!#)/g)?.length ?? 0)
	)
		warnings.transform_page_chunk_comments();
	if (!chunks) headers.set('etag', `"${hash(transformed)}"`);
	return new Response(chunks ? streamText(`${transformed}\n`, chunks) : transformed, {
		status: document.status,
		headers
	});
}

import { uneval } from 'devalue';

function inlineValue(value: unknown, server: Server): string {
	return uneval(value, function replace(value) {
		for (const [name, codec] of Object.entries(server.hooks.transport ?? {})) {
			const encoded = codec.encode(value);
			if (encoded) return `app.decode(${JSON.stringify(name)},${uneval(encoded, replace)})`;
		}
		return undefined;
	});
}
