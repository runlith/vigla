import { AsyncLocalStorage } from 'node:async_hooks';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
import { getContext, getOwner, hydratable, onDestroy, setContext } from 'vigla';
import type { Component } from 'vigla/server';
import { unflatten } from 'devalue';
import type { ServerInitOptions } from '../types/request.ts';
import type {
	PageNode,
	RequestStore,
	RootProps,
	ServerHooks,
	ServerManifest,
	ServerOptions,
	ServerRoute
} from '../types/internal/server.ts';
import { parseRoute } from '../shared/routing/index.ts';
import { ActionFailure, HttpError, Redirect } from '../shared/outcomes.ts';
import { deserialize } from '../shared/serialization.ts';
import { sha256 } from '../shared/hash.ts';
import { redirect } from '../entries/index.ts';
import { Server, getRequestEvent, getRequestOwner, read } from './index.ts';
import { page } from './state.ts';

const layout: Component<any> = (out, props) => out.push(`<main>${props.data.layout ?? ''}</main>`);
const errorComponent: Component<any> = (out, props) =>
	out.push(`<error>${props.error.status}:${props.error.message}</error>`);
const root: Component<RootProps> = (out, props) => {
	for (let node: RootProps['tree'] | null = props.tree; node; node = node.child)
		node.component(out, { data: node.data, form: props.form, error: props.error });
};

function node(
	index: number,
	server?: PageNode['server'],
	universal?: PageNode['universal'],
	component?: Component<any>
): PageNode {
	return {
		index,
		imports: [],
		stylesheets: [],
		fonts: [],
		server,
		universal,
		component: component ? async () => component : undefined
	};
}
function manifest(): ServerManifest {
	return {
		app_dir: '_app',
		app_path: '_app',
		assets: new Set(),
		mime_types: { '.txt': 'text/plain' },
		client: null,
		nodes: [
			async () => node(0, undefined, undefined, layout),
			async () => node(1, undefined, undefined, errorComponent)
		],
		remotes: {},
		routes: [],
		prerendered_routes: new Set(),
		matchers: async () => ({}),
		server_assets: {}
	};
}
function options(hooks: ServerHooks = {}): ServerOptions {
	return {
		global: '__sveltekit_contract',
		root,
		getHooks: async () => hooks,
		templates: {
			app: ({ head, body }) => `<!doctype html><head>${head}</head><body>${body}</body>`,
			error: ({ status, message }) => `${status}:${message}`
		},
		appTemplateContainsNonce: false,
		csp: {},
		csrf: { checkOrigin: true, trustedOrigins: [] },
		paths: { base: '', assets: '', relative: false },
		env: {
			set: (values) => ({
				public: { PUBLIC: values.PUBLIC },
				private: { SECRET: values.SECRET },
				rendered: { PUBLIC: values.PUBLIC }
			})
		},
		serviceWorker: null,
		version: { name: 'test', pollInterval: 0 },
		output: { preloadStrategy: 'modulepreload', bundleStrategy: 'split', linkHeaderPreload: false },
		router: { type: 'pathname', resolution: 'client' },
		embedded: false,
		tracing: { server: false },
		dev: false,
		building: false,
		prerendering: false
	};
}
function route(id: string, endpoint: ServerRoute['endpoint'] = null, page = false): ServerRoute {
	return {
		id,
		...parseRoute(id),
		page: page ? { layouts: [0], errors: [1], leaf: 2 } : null,
		endpoint
	};
}
async function start(
	manifest: ServerManifest,
	options: ServerOptions,
	init: ServerInitOptions = { env: {} }
): Promise<Server> {
	const server = new Server(manifest, options);
	await server.init(init);
	return server;
}
const address = { getClientAddress: () => '192.0.2.1' };
function request(path = '/', init?: RequestInit): Request {
	return new Request(`https://app.test${path}`, init);
}

it('rejects a malformed original pathname when reroute selects a valid path', async () => {
	const server = await start(manifest(), options({ reroute: () => '/target' }));
	const response = await server.respond(request('/%c0%ae%c0%ae/etc/passwd'), address);
	expect(response.status).toBe(400);
	await response.text();
});

it.each(['', '/__data.json'])(
	'serves rerouted prerendered resources through their deployment URL%s',
	async (suffix) => {
		const app = manifest();
		app.prerendered_routes.add('/base/prerendered/中文');
		const config = options({ reroute: () => '/base/prerendered/%E4%B8%AD%E6%96%87' });
		config.paths.base = '/base';
		const server = await start(app, config);
		vi.stubGlobal(
			'fetch',
			async (input: Request) =>
				new Response(JSON.stringify({ url: input.url, accept: input.headers.get('accept') }), {
					headers: {
						'content-type': 'application/json',
						'content-encoding': 'gzip',
						'content-length': '1234'
					}
				})
		);
		try {
			const response = await server.respond(
				request('/base/alias' + suffix + '?q=%2f+%25', { headers: { accept: 'application/json' } }),
				address
			);
			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({
				url: 'https://app.test/base/prerendered/%E4%B8%AD%E6%96%87' + suffix + '?q=%2f+%25',
				accept: 'application/json'
			});
			expect(response.headers.has('content-encoding')).toBe(false);
			expect(response.headers.has('content-length')).toBe(false);
		} finally {
			vi.unstubAllGlobals();
		}
	}
);

it('routes rerouted base paths with matcher params and endpoint method negotiation', async () => {
	const app = manifest();
	app.matchers = async () => ({
		digits: {
			'~standard': {
				version: 1,
				vendor: 'contract',
				validate: (value: unknown) =>
					typeof value === 'string' && /^\d+$/.test(value)
						? { value }
						: { issues: [{ message: 'expected digits' }] }
			}
		}
	});
	app.routes = [
		route('/item/[id=digits]', async () => ({
			GET: (event) =>
				Response.json({
					id: event.params.id,
					address: event.getClientAddress(),
					local: (event.locals as Record<string, unknown>).path,
					event: getRequestEvent() === event,
					owner: getOwner() === getRequestOwner()
				})
		}))
	];
	const config = options({
		reroute: ({ url }) => url.pathname.replace('/old/', '/item/'),
		handle: ({ event, resolve }) => {
			(event.locals as Record<string, unknown>).path = event.url.pathname;
			return resolve(event);
		}
	});
	config.paths.base = '/base';
	const server = await start(app, config);
	const response = await server.respond(request('/base/old/17'), address);
	expect(await response.json()).toEqual({
		id: '17',
		address: '192.0.2.1',
		local: '/base/old/17',
		event: true,
		owner: true
	});
	const head = await server.respond(request('/base/item/17', { method: 'HEAD' }), address);
	expect(head.status).toBe(200);
	expect(head.body).toBeNull();
	const allowed = await server.respond(request('/base/item/17', { method: 'OPTIONS' }), address);
	expect(allowed.status).toBe(204);
	expect(allowed.headers.get('allow')).toBe('GET, HEAD, OPTIONS');
	const invalid = await server.respond(
		request('/base/item/no', { headers: { accept: 'application/json' } }),
		address
	);
	expect(invalid.status).toBe(404);
});

it('keeps cookie specificity, deletion, encoding and html-data paths in the request jar', async () => {
	const app = manifest();
	app.routes = [
		route('/nested/page.html', async () => ({
			GET: ({ cookies }) => {
				cookies.set('key', 'root');
				cookies.set('key', 'nested', { path: '/nested' });
				cookies.set('key', 'exact', { path: '' });
				cookies.delete('old');
				cookies.set('unicode', 'fö');
				return Response.json({
					key: cookies.get('key'),
					all: cookies.getAll(),
					raw: cookies.get('raw', { decode: (value) => value }),
					serialized: cookies.serialize('x', 'y', { path: './' })
				});
			}
		}))
	];
	const server = await start(app, options());
	const response = await server.respond(
		request('/nested/page.html', { headers: { cookie: 'old=gone; raw=hello%20world' } }),
		address
	);
	const value = await response.json();
	expect(value.key).toBe('exact');
	expect(value.all).toEqual([
		{ name: 'raw', value: 'hello world' },
		{ name: 'key', value: 'exact' },
		{ name: 'unicode', value: 'fö' }
	]);
	expect(value.raw).toBe('hello%20world');
	expect(value.serialized).toContain('Path=/nested/');
	const cookies = response.headers.getSetCookie();
	expect(cookies).toContain('key=exact; Path=/nested/page.html; HttpOnly; Secure; SameSite=Lax');
	expect(cookies).toContain(
		'key=exact; Path=/nested/page.html__data.json; HttpOnly; Secure; SameSite=Lax'
	);
	expect(cookies.some((cookie) => cookie.startsWith('old=; Max-Age=0;'))).toBe(true);
});

it('merges server-timing but refuses duplicate headers and cookie headers', async () => {
	const app = manifest();
	app.routes = [
		route('/', async () => ({
			GET: (event) => {
				event.setHeaders({ 'server-timing': 'a;dur=1' });
				event.setHeaders({ 'Server-Timing': 'b;dur=2', 'cache-control': 'private' });
				let duplicate = false;
				let cookie = false;
				try {
					event.setHeaders({ 'Cache-Control': 'public' });
				} catch {
					duplicate = true;
				}
				try {
					event.setHeaders({ 'set-cookie': 'bad' });
				} catch {
					cookie = true;
				}
				return Response.json({ duplicate, cookie });
			}
		}))
	];
	const server = await start(app, options());
	const response = await server.respond(request(), address);
	expect(response.headers.get('server-timing')).toBe('a;dur=1, b;dur=2');
	expect(await response.json()).toEqual({ duplicate: true, cookie: true });
});

it('checks mutating form origins before hooks and dispatches only the remote seam', async () => {
	const app = manifest();
	app.routes = [route('/', async () => ({ POST: () => new Response('endpoint') }))];
	const config = options({
		handle: ({ event, resolve }) => {
			event.setHeaders({ 'x-hook': 'yes' });
			return resolve(event);
		}
	});
	config.csrf.trustedOrigins = ['https://trusted.test'];
	config.remote = async ({ id, name, store }) =>
		Response.json({ id, name, remote: store.event.isRemoteRequest });
	const server = await start(app, config);
	const denied = await server.respond(
		request('/', {
			method: 'POST',
			body: 'x=1',
			headers: { origin: 'https://other.test', accept: 'application/json' }
		}),
		address
	);
	expect(denied.status).toBe(403);
	expect(denied.headers.has('x-hook')).toBe(false);
	const allowed = await server.respond(
		request('/', { method: 'POST', body: 'x=1', headers: { origin: 'https://trusted.test' } }),
		address
	);
	expect(await allowed.text()).toBe('endpoint');
	const remote = await server.respond(
		request('/_app/remote/file/name', { method: 'POST', headers: { origin: 'https://app.test' } }),
		address
	);
	expect(await remote.json()).toEqual({ id: 'file', name: 'name', remote: true });
	const crossRemote = await server.respond(
		request('/_app/remote/file/name', {
			method: 'POST',
			headers: { origin: 'https://trusted.test' }
		}),
		address
	);
	expect(crossRemote.status).toBe(403);
});

it('preserves per-request async contexts across interleaved servers and disposes after body consumption', async () => {
	let destroyed = 0;
	const key = Symbol('request graph');
	const app = manifest();
	app.routes = [
		route('/[id]', async () => ({
			GET: async (event) => {
				await Promise.resolve();
				const owner = getRequestOwner();
				return Response.json({
					id: getRequestEvent().params.id,
					context: owner.run(() => getContext(key)),
					alive: !owner.disposed
				});
			}
		}))
	];
	const config = options({
		handle: ({ event, resolve }) => {
			setContext(key, event.params.id);
			onDestroy(() => {
				destroyed++;
			});
			return resolve(event);
		}
	});
	const first = await start(app, config, { env: {}, scope: new AsyncLocalStorage<RequestStore>() });
	const second = await start(app, config, {
		env: {},
		scope: new AsyncLocalStorage<RequestStore>()
	});
	const responses = await Promise.all([
		first.respond(request('/one'), address),
		second.respond(request('/two'), address)
	]);
	expect(destroyed).toBe(0);
	expect(await Promise.all(responses.map((response) => response.json()))).toEqual([
		{ id: 'one', context: 'one', alive: true },
		{ id: 'two', context: 'two', alive: true }
	]);
	expect(destroyed).toBe(2);
	expect(() => getRequestEvent()).toThrow();
});

it('allows synchronous event lookup without a port and refuses it after an await', async () => {
	const app = manifest();
	app.routes = [
		route('/', async () => ({
			GET: async (event) => {
				const before = getRequestEvent() === event;
				await Promise.resolve();
				let after = false;
				try {
					getRequestEvent();
				} catch {
					after = true;
				}
				return Response.json({ before, after });
			}
		}))
	];
	const server = await start(app, options());
	expect(await (await server.respond(request(), address)).json()).toEqual({
		before: true,
		after: true
	});
});

it('disposes a request owner on body cancellation and request abort', async () => {
	let destroyed = 0;
	const app = manifest();
	app.routes = [
		route('/', async () => ({
			GET: () =>
				new Response(
					new ReadableStream(
						{
							pull(controller) {
								controller.enqueue(new Uint8Array([1]));
							}
						},
						{ highWaterMark: 0 }
					)
				)
		}))
	];
	const server = await start(
		app,
		options({
			handle: ({ event, resolve }) => {
				onDestroy(() => {
					destroyed++;
				});
				return resolve(event);
			}
		})
	);
	const first = await server.respond(request(), address);
	await first.body!.cancel();
	expect(destroyed).toBe(1);
	const controller = new AbortController();
	const second = await server.respond(request('/', { signal: controller.signal }), address);
	controller.abort();
	expect(destroyed).toBe(2);
	await expect(second.text()).rejects.toBeDefined();
});

it('cancels a pending deferred body read and tears down its request without waiting for the value', async () => {
	let destroyed = 0;
	const app = manifest();
	app.nodes[2] = async () =>
		node(2, { load: () => ({ later: new Promise(() => {}) }) }, undefined, layout);
	app.routes = [route('/', null, true)];
	const server = await start(
		app,
		options({
			handle: ({ event, resolve }) => {
				onDestroy(() => {
					destroyed++;
				});
				return resolve(event);
			}
		})
	);
	const response = await server.respond(request('/__data.json'), address);
	const reader = response.body!.getReader();
	await reader.read();
	const pending = reader.read();
	await reader.cancel();
	expect((await pending).done).toBe(true);
	expect(destroyed).toBe(1);
});

it('dispatches same-origin event fetch internally with credentials and imports returned cookies', async () => {
	const app = manifest();
	app.routes = [
		route('/outer', async () => ({
			GET: async ({ fetch, cookies }) => {
				const inner = await fetch('/inner');
				return Response.json({ inner: await inner.json(), token: cookies.get('token') });
			}
		})),
		route('/inner', async () => ({
			GET: ({ request, isSubRequest, cookies }) => {
				cookies.set('token', 'new');
				return Response.json({
					cookie: request.headers.get('cookie'),
					authorization: request.headers.get('authorization'),
					language: request.headers.get('accept-language'),
					origin: request.headers.get('origin'),
					subrequest: isSubRequest
				});
			}
		}))
	];
	const server = await start(
		app,
		options({
			handleFetch: ({ request, fetch }) => {
				request.headers.set('x-projected', 'yes');
				return fetch(request);
			}
		})
	);
	const response = await server.respond(
		request('/outer', {
			headers: { cookie: 'session=abc', authorization: 'secret', 'accept-language': 'en' }
		}),
		address
	);
	expect(await response.json()).toEqual({
		inner: {
			cookie: 'session=abc',
			authorization: 'secret',
			language: 'en',
			origin: null,
			subrequest: true
		},
		token: 'new'
	});
	expect(response.headers.getSetCookie().some((cookie) => cookie.startsWith('token=new;'))).toBe(
		true
	);
});

it('loads server parents on demand for invalidated data and streams deferred values as NDJSON', async () => {
	const app = manifest();
	let complete!: (value: string) => void;
	const later = new Promise<string>((resolve) => {
		complete = resolve;
	});
	app.nodes[0] = async () => node(0, { load: () => ({ layout: 'base' }) }, undefined, layout);
	app.nodes[2] = async () =>
		node(
			2,
			{
				load: async ({ parent, depends, params, url }) => {
					depends('custom:post');
					const inherited = await parent();
					return {
						inherited: inherited.layout,
						id: params.id,
						q: url.searchParams.get('q'),
						later
					};
				}
			},
			undefined,
			layout
		);
	app.routes = [route('/[id]', null, true)];
	const server = await start(app, options());
	const response = await server.respond(
		request('/post/__data.json?q=one&x-sveltekit-invalidated=01'),
		address
	);
	expect(response.headers.get('content-type')).toBe('text/sveltekit-data');
	const reader = response.body!.getReader();
	const first = JSON.parse(new TextDecoder().decode((await reader.read()).value));
	expect(first.nodes[0]).toEqual({ type: 'skip' });
	expect(first.nodes[1].uses).toEqual({
		dependencies: ['custom:post'],
		params: ['id'],
		search_params: ['q'],
		parent: 1
	});
	const data = unflatten(first.nodes[1].data, { Promise: (id) => id });
	expect(data).toEqual({ inherited: 'base', id: 'post', q: 'one', later: 1 });
	complete('resolved');
	const chunk = JSON.parse(new TextDecoder().decode((await reader.read()).value));
	expect({ ...chunk, data: unflatten(chunk.data) }).toEqual({
		type: 'chunk',
		id: 1,
		data: 'resolved'
	});
	expect((await reader.read()).done).toBe(true);
});

it('runs server then universal loads with inherited data and request context in the rendered document', async () => {
	const key = Symbol('graph');
	const app = manifest();
	app.nodes[0] = async () => node(0, { load: () => ({ layout: 'parent' }) }, undefined, layout);
	app.nodes[2] = async () =>
		node(
			2,
			{
				load: async ({ parent }) => {
					await Promise.resolve();
					return {
						parent: (await parent()).layout,
						context: getRequestOwner().run(() => getContext(key))
					};
				}
			},
			{
				load: async ({ data, parent }) => ({
					value: `${(await parent()).layout}:${data!.parent}:${data!.context}`
				})
			},
			(out, props) =>
				out.push(`<article>${props.data.value}:${getContext(key)}:${page.status}</article>`)
		);
	app.routes = [route('/', null, true)];
	const server = await start(
		app,
		options({
			handle: ({ event, resolve }) => {
				setContext(key, 'request');
				return resolve(event);
			}
		}),
		{ env: {}, scope: new AsyncLocalStorage<RequestStore>() }
	);
	const response = await server.respond(
		request('/', { headers: { accept: 'text/html' } }),
		address
	);
	expect(await response.text()).toContain('<article>parent:parent:request:request:200</article>');
});

it('includes hydratable values registered in hooks and server load in the core head script', async () => {
	const app = manifest();
	app.nodes[2] = async () =>
		node(
			2,
			{
				load: async () => {
					await Promise.resolve();
					const snapshot = getRequestOwner().run(() => hydratable('load', () => 'load-snapshot'));
					return { snapshot };
				}
			},
			undefined,
			(out, props) =>
				out.push(
					`<snapshot>${props.data.snapshot}:${hydratable('hook', () => 'hook-snapshot')}</snapshot>`
				)
		);
	app.routes = [route('/', null, true)];
	const server = await start(
		app,
		options({
			handle: ({ event, resolve }) => {
				hydratable('hook', () => 'hook-snapshot');
				return resolve(event);
			}
		}),
		{ env: {}, scope: new AsyncLocalStorage<RequestStore>() }
	);
	const response = await server.respond(
		request('/', { headers: { accept: 'text/html' } }),
		address
	);
	const html = await response.text();
	expect(html).toContain('<snapshot>load-snapshot:hook-snapshot</snapshot>');
	const head = html.slice(0, html.indexOf('</head>'));
	expect(head).toContain('load-snapshot');
	expect(head).toContain('hook-snapshot');
});

it('serializes universal fetch replay safely and uses the generated boot global', async () => {
	const app = manifest();
	app.client = {
		start: '_app/start.js',
		app: '_app/app.js',
		imports: ['_app/start.js'],
		stylesheets: ['_app/style.css'],
		fonts: [],
		uses_env_dynamic_public: true
	};
	app.nodes[2] = async () =>
		node(
			2,
			undefined,
			{ load: async ({ fetch }) => ({ result: await (await fetch('/resource')).json() }) },
			(out, props) => out.push(`<article>${props.data.result.value}</article>`)
		);
	app.routes = [
		route('/', null, true),
		route('/resource', async () => ({
			GET: () =>
				Response.json(
					{ value: '</script><script>bad</script>' },
					{
						headers: { 'cache-control': 'max-age=20', age: '3', 'content-type': 'application/json' }
					}
				)
		}))
	];
	const config = options({
		handle: ({ event, resolve }) =>
			resolve(event, { filterSerializedResponseHeaders: (name) => name === 'content-type' })
	});
	config.csp = { directives: { 'default-src': ['self'] } };
	const server = await start(app, config, { env: { PUBLIC: 'visible' } });
	const response = await server.respond(
		request('/', { headers: { accept: 'text/html' } }),
		address
	);
	const html = await response.text();
	expect(html).toContain('data-sveltekit-fetched data-url="/resource" data-ttl="17"');
	expect(html).toContain('\\u003c/script>');
	expect(html).toContain('globalThis.__sveltekit_contract=');
	expect(html).toContain('kit.init(__sveltekit_contract)');
	expect(response.headers.get('content-security-policy')).toMatch(/script-src 'self' 'nonce-/);
	expect(response.headers.get('etag')).toBeTruthy();
});

it('returns named form failures and redirects in the upstream action wire format', async () => {
	const app = manifest();
	app.nodes[2] = async () =>
		node(
			2,
			{
				actions: {
					save: () => new ActionFailure(422, { missing: true }),
					next: () => {
						throw new Redirect(303, '/done');
					}
				}
			},
			undefined,
			layout
		);
	app.routes = [route('/', null, true)];
	const server = await start(app, options());
	const init = {
		method: 'POST',
		body: 'x=1',
		headers: {
			origin: 'https://app.test',
			accept: 'application/json',
			'x-sveltekit-action': 'true'
		}
	};
	const response = await server.respond(request('/?/save&other=1', init), address);
	const result = await response.json();
	expect(response.status).toBe(422);
	expect({ ...result, data: deserialize(result.data) }).toEqual({
		type: 'failure',
		status: 422,
		location: '/?other=1',
		data: { missing: true }
	});
	const redirect = await server.respond(request('/?/next', init), address);
	expect(await redirect.json()).toEqual({ type: 'redirect', status: 303, location: '/done' });
});

it('turns handle redirects into data redirects without dropping response cookies', async () => {
	const app = manifest();
	app.nodes[2] = async () => node(2, undefined, undefined, layout);
	app.routes = [route('/go', null, true)];
	const server = await start(
		app,
		options({
			handle: ({ event }) => {
				event.cookies.set('redirected', 'yes', { path: '/' });
				return new Response(null, { status: 307, headers: { location: '/target' } });
			}
		})
	);
	const response = await server.respond(request('/go/__data.json'), address);
	expect(response.status).toBe(200);
	expect(response.headers.getSetCookie()).toContain(
		'redirected=yes; Path=/; HttpOnly; Secure; SameSite=Lax'
	);
	expect(await response.json()).toEqual({ type: 'redirect', status: 307, location: '/target' });
});

it('allows same-origin absolute hook redirects after an await and retains deleted cookies', async () => {
	const app = manifest();
	app.nodes[2] = async () => node(2, undefined, undefined, layout);
	app.routes = [route('/go', null, true)];
	const server = await start(
		app,
		options({
			async handle({ event }) {
				await Promise.resolve();
				event.cookies.delete('session', { path: '/cookies' });
				redirect(307, new URL('/cookies', event.url));
			},
			handleError: ({ error }) => ({ message: (error as Error).message })
		}),
		{ env: {}, scope: new AsyncLocalStorage<RequestStore>() }
	);
	const document = await server.respond(request('/go'), address);
	expect(document.status).toBe(307);
	expect(document.headers.get('location')).toBe('https://app.test/cookies');
	expect(document.headers.getSetCookie()).toEqual([
		expect.stringContaining('session=; Max-Age=0; Path=/cookies')
	]);
	expect(document.body).toBeNull();
	const data = await server.respond(request('/go/__data.json'), address);
	expect(await data.json()).toEqual({
		type: 'redirect',
		status: 307,
		location: 'https://app.test/cookies'
	});
	expect(data.headers.getSetCookie()).toEqual(document.headers.getSetCookie());
});

it('rejects an aborted internal fetch before its endpoint returns headers', async () => {
	const app = manifest();
	const controller = new AbortController();
	app.routes = [
		route('/', async () => ({
			GET: async ({ fetch }) => {
				const errorName = async (signal: AbortSignal) => {
					try {
						await fetch('/slow', { signal });
						return 'fulfilled';
					} catch (error) {
						return error instanceof Error ? error.name : 'unknown';
					}
				};
				return Response.json({
					immediate: await errorName(AbortSignal.abort()),
					pending: await errorName(controller.signal),
					data: await (await fetch('/data')).json()
				});
			}
		})),
		route('/slow', async () => ({
			GET: () => {
				queueMicrotask(() => controller.abort(new DOMException('deadline', 'TimeoutError')));
				return new Promise<Response>(() => {});
			}
		})),
		route('/data', async () => ({ GET: () => Response.json('success') }))
	];
	const server = await start(app, options());
	const response = await server.respond(request(), address);
	expect(await response.json()).toEqual({
		immediate: 'AbortError',
		pending: 'AbortError',
		data: 'success'
	});
}, 1000);

it('replays a bodyless fetched response as a valid Web Response', async () => {
	const app = manifest();
	app.client = {
		start: '/start.js',
		imports: [],
		stylesheets: [],
		fonts: [],
		uses_env_dynamic_public: false
	};
	app.nodes[2] = async () =>
		node(
			2,
			undefined,
			{
				load: async ({ fetch }) => ({ layout: await (await fetch('/empty')).text() })
			},
			layout
		);
	app.routes = [
		route('/', null, true),
		route('/empty', async () => ({ GET: () => new Response(null, { status: 204 }) }))
	];
	const server = await start(app, options());
	const response = await server.respond(request(), address);
	const html = await response.text();
	const replay = JSON.parse(/data-sveltekit-fetched[^>]*>([^<]*)<\/script>/.exec(html)![1]!);
	const restored = new Response(replay.body, replay);
	expect(restored.status).toBe(204);
	expect(restored.body).toBeNull();
	expect(await restored.text()).toBe('');
});

it('reports invalid load results at their source and serializes data paths once', async () => {
	const app = manifest();
	app.nodes[2] = async () => ({
		...node(2, { load: () => [] as any }, undefined, layout),
		server_id: 'src/routes/+page.server.js'
	});
	app.routes = [route('/', null, true)];
	const server = await start(
		app,
		options({ handleError: ({ error }) => ({ message: (error as Error).message }) })
	);
	const invalid = await server.respond(
		request('/', { headers: { accept: 'application/json' } }),
		address
	);
	expect((await invalid.json()).message).toMatch(
		/load_invalid_response[\s\S]*in src\/routes\/\+page.server.js[\s\S]*an array/
	);
	app.nodes[2] = async () =>
		node(2, { load: () => ({ nope: new (class Unsupported {})() }) }, undefined, layout);
	const serialized = await server.respond(
		request('/', { headers: { accept: 'application/json' } }),
		address
	);
	expect((await serialized.json()).message).toContain(
		'Cannot stringify arbitrary non-POJOs (`data.nope`)'
	);
});

it('keeps rendered boundary errors inside their ancestor layout and updates the page status', async () => {
	const app = manifest();
	app.nodes[0] = async () =>
		node(0, undefined, undefined, (out, props) => {
			props.children(out);
			out.push('<footer>root layout</footer>');
		});
	app.nodes[1] = async () =>
		node(1, undefined, undefined, (out) =>
			out.push(`<failure>${page.status}:${page.error?.message}</failure>`)
		);
	app.nodes[2] = async () =>
		node(2, undefined, undefined, (out, props) => {
			props.children(out);
			out.push('<inner-layout/>');
		});
	app.nodes[3] = async () =>
		node(3, undefined, undefined, () => {
			throw new Error('render failed');
		});
	const nested = route('/', null, true);
	nested.page = { layouts: [0, undefined, 2], errors: [1, undefined, undefined], leaf: 3 };
	app.routes = [nested];
	const config = options({ handleError: () => ({ status: 404, message: 'handled render' }) });
	config.root = (out, props) => {
		const visit = (out: Parameters<Component>[0], branch: RootProps['tree']): void => {
			out.boundary(
				{
					failed: branch.error ? (out, error) => branch.error!(out, { error }) : undefined
				},
				(out) =>
					branch.component(out, {
						data: branch.data,
						children: (out: Parameters<Component>[0]) => visit(out, branch.child!)
					})
			);
		};
		visit(out, props.tree);
	};
	const server = await start(app, config);
	const response = await server.respond(request(), address);
	const html = await response.text();
	expect(response.status).toBe(404);
	expect(html).toContain('<failure>404:handled render</failure>');
	expect(html).toContain('<footer>root layout</footer>');
	expect(html).not.toContain('<inner-layout/>');
});

it('uses the action destination boundary and retains its successful layout data', async () => {
	const app = manifest();
	app.nodes[2] = async () =>
		node(2, { load: () => ({ layout: 'destination' }) }, undefined, layout);
	app.nodes[3] = async () =>
		node(3, undefined, undefined, (out, props) =>
			out.push(`<destination>${props.data.layout}:${props.error.message}</destination>`)
		);
	app.nodes[4] = async () =>
		node(
			4,
			{
				actions: {
					default: () => {
						throw new HttpError({ status: 400, message: 'action failed' });
					}
				}
			},
			undefined,
			layout
		);
	const destination = route('/destination', null, true);
	destination.page = { layouts: [0, 2], errors: [1, 3], leaf: 4 };
	app.routes = [destination];
	const server = await start(app, options());
	const response = await server.respond(
		request('/destination', {
			method: 'POST',
			body: 'x=1',
			headers: { origin: 'https://app.test', accept: 'text/html' }
		}),
		address
	);
	expect(response.status).toBe(400);
	expect(await response.text()).toContain('<destination>destination:action failed</destination>');
});

it('uses the static fallback for root load failures after their trigger cookie is deleted', async () => {
	const app = manifest();
	app.nodes[0] = async () =>
		node(
			0,
			{
				load: ({ cookies }) => {
					const type = cookies.get('fail-type');
					if (type) {
						cookies.delete('fail-type', { path: '/' });
						if (type === 'expected') throw new HttpError({ status: 401, message: 'root denied' });
						throw new Error('root failed');
					}
					return { layout: 'reloaded root' };
				}
			},
			undefined,
			layout
		);
	app.nodes[2] = async () => node(2, undefined, undefined, layout);
	app.routes = [route('/', null, true)];
	const server = await start(
		app,
		options({ handleError: ({ error }) => ({ message: `handled:${(error as Error).message}` }) })
	);
	for (const [type, status, message] of [
		['unexpected', 500, 'root failed'],
		['expected', 401, 'root denied']
	] as const) {
		const response = await server.respond(
			request('/', { headers: { accept: 'text/html', cookie: `fail-type=${type}` } }),
			address
		);
		expect(response.status).toBe(status);
		expect(await response.text()).toBe(`${status}:handled:${message}`);
		expect(response.headers.getSetCookie()).toEqual([
			expect.stringContaining('fail-type=; Max-Age=0; Path=/')
		]);
	}
});

it('uses an ancestor error component when a nested layout load fails', async () => {
	const app = manifest();
	app.nodes[2] = async () =>
		node(2, {
			load: () => {
				throw new HttpError({ status: 409, message: 'nested failed' });
			}
		});
	app.nodes[3] = async () => node(3, undefined, undefined, (out) => out.push('<self-error/>'));
	app.nodes[4] = async () => node(4, undefined, undefined, layout);
	const nested = route('/', null, true);
	nested.page = { layouts: [0, 2], errors: [1, 3], leaf: 4 };
	app.routes = [nested];
	const server = await start(app, options());
	const response = await server.respond(request(), address);
	const html = await response.text();
	expect(response.status).toBe(409);
	expect(html).toContain('<main></main><error>409:nested failed</error>');
	expect(html).not.toContain('<self-error/>');
});

it('preserves a redirect thrown by the root load while rendering a missing route', async () => {
	const app = manifest();
	app.nodes[0] = async () =>
		node(0, {
			load: ({ cookies }) => {
				cookies.delete('fail-type', { path: '/' });
				redirect(307, '/load');
			}
		});
	const server = await start(app, options());
	const response = await server.respond(
		request('/missing', { headers: { accept: 'text/html', cookie: 'fail-type=redirect' } }),
		address
	);
	expect(response.status).toBe(307);
	expect(response.headers.get('location')).toBe('/load');
	expect(response.body).toBeNull();
	expect(response.headers.getSetCookie()).toEqual([
		expect.stringContaining('fail-type=; Max-Age=0; Path=/')
	]);
});

it('transforms errors once, renders the closest error node and falls back when its component fails', async () => {
	const app = manifest();
	app.nodes[2] = async () =>
		node(
			2,
			{
				load: () => {
					throw new HttpError({ status: 418, message: 'teapot' });
				}
			},
			undefined,
			layout
		);
	app.routes = [route('/', null, true)];
	const server = await start(
		app,
		options({ handleError: ({ kind }) => ({ message: `handled:${kind}` }) })
	);
	const response = await server.respond(
		request('/', { headers: { accept: 'text/html' } }),
		address
	);
	expect(response.status).toBe(418);
	expect(await response.text()).toContain('<error>418:handled:app</error>');
	app.nodes[1] = async () =>
		node(1, undefined, undefined, () => {
			throw new Error('broken error component');
		});
	const fallback = await server.respond(
		request('/', { headers: { accept: 'text/html' } }),
		address
	);
	expect(await fallback.text()).toBe('418:handled:app');
});

it('drops deeper layouts when the closest error boundary has sparse ancestor indexes', async () => {
	const app = manifest();
	app.nodes[0] = async () => node(0, undefined, undefined, (out) => out.push('<root/>'));
	app.nodes[2] = async () => node(2, undefined, undefined, (out) => out.push('<middle/>'));
	app.nodes[3] = async () => node(3, undefined, undefined, (out) => out.push('<nested-error/>'));
	app.nodes[4] = async () => node(4, undefined, undefined, (out) => out.push('<deep/>'));
	app.nodes[5] = async () =>
		node(
			5,
			{
				load: () => {
					throw new HttpError({ status: 400, message: 'failed' });
				}
			},
			undefined,
			layout
		);
	const page = route('/', null, true);
	page.page = { layouts: [0, undefined, 2, 4], errors: [1, undefined, 3, undefined], leaf: 5 };
	app.routes = [page];
	const server = await start(app, options());
	const response = await server.respond(
		request('/', { headers: { accept: 'text/html' } }),
		address
	);
	const html = await response.text();
	expect(response.status).toBe(400);
	expect(html).toContain('<root/><middle/><nested-error/>');
	expect(html).not.toContain('<deep/>');
});

it('reports streamed serialization failures with their cause and keeps the initial data valid', async () => {
	const app = manifest();
	app.nodes[2] = async () =>
		node(
			2,
			{ load: () => ({ later: Promise.resolve(new (class Unsupported {})()) }) },
			undefined,
			layout
		);
	app.routes = [route('/', null, true)];
	const server = await start(
		app,
		options({
			handleError: ({ error }) => ({
				message:
					error instanceof Error && error.cause instanceof Error
						? 'serialization cause retained'
						: 'missing cause'
			})
		})
	);
	const response = await server.respond(request('/__data.json'), address);
	const lines = (await response.text())
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line));
	expect(lines[0].type).toBe('data');
	expect(lines[1].type).toBe('chunk');
	expect(unflatten(lines[1].error)).toEqual({
		status: 500,
		message: 'serialization cause retained'
	});
});

it('enforces browser fetch CORS and serialized header access during universal loads', async () => {
	const app = manifest();
	app.nodes[2] = async () =>
		node(
			2,
			undefined,
			{
				load: async ({ fetch, params }) => {
					const response = await fetch(
						`https://remote.test/${params.kind}`,
						params.kind === 'opaque' ? { mode: 'no-cors' } : undefined
					);
					if (params.kind === 'headers') response.headers.get('x-secret');
					return { result: await response.text() };
				}
			},
			(out, props) => out.push(`<article>${props.data.result}</article>`)
		);
	app.routes = [route('/[kind]', null, true)];
	const server = await start(
		app,
		options({
			handleFetch: ({ request }) =>
				new Response('remote', {
					headers: {
						...(new URL(request.url).pathname === '/denied'
							? {}
							: { 'access-control-allow-origin': '*' }),
						'x-secret': 'hidden'
					}
				}),
			handleError: ({ error }) => ({
				message: error instanceof Error ? error.message.split('\n')[0]! : 'unknown'
			})
		})
	);
	const opaque = await server.respond(
		request('/opaque', { headers: { accept: 'text/html' } }),
		address
	);
	expect(await opaque.text()).toContain('<article></article>');
	const allowed = await server.respond(
		request('/allowed', { headers: { accept: 'text/html' } }),
		address
	);
	expect(await allowed.text()).toContain('<article>remote</article>');
	const denied = await server.respond(
		request('/denied', { headers: { accept: 'text/html' } }),
		address
	);
	expect(await denied.text()).toContain('<error>500:load_fetch_cors</error>');
	app.client = {
		start: '_app/start.js',
		app: '_app/app.js',
		imports: [],
		stylesheets: [],
		fonts: [],
		uses_env_dynamic_public: false
	};
	const headers = await server.respond(
		request('/headers', { headers: { accept: 'text/html' } }),
		address
	);
	expect(await headers.text()).toContain('<error>500:load_response_header_not_serialized</error>');
});

it('rejects prerender query reads outside reroute and preserves route ids on error data', async () => {
	const app = manifest();
	app.nodes[2] = async () =>
		node(
			2,
			{ prerender: true, load: ({ url }) => ({ query: url.searchParams.get('q') }) },
			undefined,
			layout
		);
	app.routes = [
		route('/api', async () => ({
			GET: ({ url }) => Response.json({ destination: url.searchParams.get('q') })
		})),
		route('/target', async () => ({ prerender: true, GET: () => new Response('target') })),
		route('/query', async () => ({
			prerender: true,
			GET: ({ url }) => Response.json({ query: url.searchParams.get('q') })
		})),
		route('/page', null, true)
	];
	const server = await start(
		app,
		options({
			reroute: async ({ url, fetch }) =>
				url.pathname === '/entry'
					? (await (await fetch('/api?q=/target')).json()).destination
					: undefined,
			handle: ({ event, resolve }) => {
				if (event.url.pathname === '/entry') void event.url.search;
				return resolve(event);
			},
			handleError: ({ error }) => ({
				status: 400,
				message: error instanceof Error ? error.message.split('\n')[0]! : 'unknown'
			})
		})
	);
	const prerendering = () => ({ fallback: false, insideReroute: false, dependencies: new Map() });
	const hook = await server.respond(
		request('/entry?q=blocked', { headers: { accept: 'application/json' } }),
		{ ...address, prerendering: prerendering() }
	);
	expect(hook.status).toBe(400);
	expect(hook.headers.get('x-sveltekit-routeid')).toBe('/target');
	expect(await hook.json()).toEqual({ status: 400, message: 'url_search_unavailable_prerender' });
	const endpoint = await server.respond(
		request('/query?q=blocked', { headers: { accept: 'application/json' } }),
		{ ...address, prerendering: prerendering() }
	);
	expect(endpoint.status).toBe(400);
	expect(endpoint.headers.get('x-sveltekit-routeid')).toBe('/query');
	expect(await endpoint.json()).toEqual({
		status: 400,
		message: 'url_search_unavailable_prerender'
	});
	const data = await server.respond(request('/page/__data.json?q=blocked'), {
		...address,
		prerendering: prerendering()
	});
	expect(data.headers.get('x-sveltekit-routeid')).toBe('/page');
	expect((await data.json()).nodes[1].error).toEqual({
		status: 400,
		message: 'url_search_unavailable_prerender'
	});
});

it('renders the prerender fallback as an absolute-path CSR shell without routing or request hooks', async () => {
	const app = manifest();
	app.client = {
		start: '_app/start.js',
		app: '_app/app.js',
		imports: [],
		stylesheets: [],
		fonts: [],
		uses_env_dynamic_public: true
	};
	app.matchers = async () => {
		throw new Error('fallback must not match routes');
	};
	app.nodes = [
		async () => {
			throw new Error('fallback must not load nodes');
		}
	];
	const config = options({
		handle: () => {
			throw new Error('fallback must not call handle');
		},
		reroute: () => {
			throw new Error('fallback must not reroute');
		}
	});
	config.paths = { base: '/base', assets: '', relative: true };
	config.building = true;
	config.prerendering = true;
	config.root = () => {
		throw new Error('fallback must not render components');
	};
	const server = await start(app, config);
	const response = await server.respond(request('/[fallback]'), {
		...address,
		prerendering: { fallback: true, insideReroute: false, dependencies: new Map() }
	});
	const html = await response.text();
	expect(response.status).toBe(200);
	expect(html).toContain('import("/base/_app/start.js")');
	expect(html).toContain('import("/base/_app/env.js")');
	expect(html).not.toContain('<main>');
	expect(html).not.toContain('node_ids:');
});

it('decodes inline hydration through the deferred bundle module namespace', async () => {
	class Point {
		readonly x: number;
		constructor(x: number) {
			this.x = x;
		}
	}
	const app = manifest();
	app.client = {
		start: '',
		imports: [],
		stylesheets: [],
		fonts: [],
		uses_env_dynamic_public: false,
		inline: {
			style: undefined,
			script: `let loaded; globalThis.__sveltekit_contract.app = {
				init() {},
				start(target, hydrate) {
					loaded = { decode: (_name, value) => ({ x: value[0] }) };
					try { target.resolve(hydrate().data[1].data.point); }
					catch (error) { target.reject(error); }
				},
				decode(name, value) { return loaded.decode(name, value); }
			}`
		}
	};
	app.nodes[2] = async () => node(2, { load: () => ({ point: new Point(42) }) }, undefined, layout);
	app.routes = [route('/', null, true)];
	const config = options({
		transport: {
			Point: {
				encode: (value) => value instanceof Point && [value.x],
				decode: (value) => new Point(value[0])
			}
		}
	});
	const server = await start(app, config);
	const response = await server.respond(
		request('/', { headers: { accept: 'text/html' } }),
		address
	);
	const html = await response.text();
	const script = /<script[^>]*>([\s\S]*?)<\/script>/.exec(html)![1]!;
	const result = Promise.withResolvers<{ x: number }>();
	runInNewContext(script, { document: { currentScript: { parentElement: result } }, Promise });
	expect(await result.promise).toEqual({ x: 42 });
});

it('emits an inline client stylesheet and its CSP hash without an external stylesheet', async () => {
	const app = manifest();
	const css = '.inline{color:red}';
	app.client = {
		start: '',
		imports: [],
		stylesheets: [],
		fonts: [],
		uses_env_dynamic_public: false,
		inline: { script: 'bootstrap()', style: () => css }
	};
	app.nodes[2] = async () => node(2, { ssr: false }, undefined, layout);
	app.routes = [route('/', null, true)];
	const config = options();
	config.csp = { mode: 'hash', directives: { 'default-src': ['self'] } };
	const server = await start(app, config);
	const response = await server.respond(
		request('/', { headers: { accept: 'text/html' } }),
		address
	);
	expect(await response.text()).toContain(`<style>${css}</style>`);
	expect(response.headers.get('content-security-policy')).toContain(
		`'sha256-${await sha256(css)}'`
	);
});

it('keeps initial fetch replay keys and TTL aligned with the document request', async () => {
	const app = manifest();
	app.client = {
		start: '/start.js',
		imports: [],
		stylesheets: [],
		fonts: [],
		uses_env_dynamic_public: false
	};
	app.nodes[2] = async () =>
		node(
			2,
			undefined,
			{
				load: async ({ fetch }) => ({
					layout:
						(await (await fetch(new Request('https://app.test/data'))).text()) +
						(await (await fetch('/data', { method: 'POST', body: 'value' })).text())
				})
			},
			layout
		);
	app.routes = [
		route('/', null, true),
		route('/data', async () => ({
			GET: () => new Response('read', { headers: { 'cache-control': 'max-age=30' } }),
			POST: () => new Response('posted', { headers: { 'cache-control': 'max-age=30' } })
		}))
	];
	const server = await start(app, options());
	const response = await server.respond(request(), address);
	const scripts = [
		...(await response.text()).matchAll(/<script ([^>]*data-sveltekit-fetched[^>]*)>/g)
	];
	expect(scripts).toHaveLength(2);
	expect(scripts[0]![1]).not.toContain('data-hash');
	expect(scripts[1]![1]).toContain('data-ttl="30"');
});

it('emulates route configuration before hooks for pages, endpoints and fallback requests', async () => {
	const app = manifest();
	app.nodes[0] = async () =>
		node(0, { config: { inherited: true, message: 'root' } }, undefined, layout);
	app.nodes[2] = async () =>
		node(
			2,
			{ prerender: true, config: { message: 'server' } },
			{ config: { message: 'page' } },
			layout
		);
	app.routes = [
		route('/page', null, true),
		route('/api', async () => ({
			config: { message: 'endpoint' },
			prerender: 'auto',
			GET: ({ platform }) => Response.json(platform)
		}))
	];
	const server = await start(
		app,
		options({
			handle: ({ event, resolve }) =>
				event.route.id === '/page'
					? Response.json({ platform: event.platform, query: event.url.searchParams.get('q') })
					: event.route.id === null
						? Response.json(event.platform)
						: resolve(event)
		})
	);
	const emulator = {
		platform: ({ config, prerender }: import('../types/builder.ts').EmulationInput) => ({
			config,
			prerender
		})
	};
	const pageResponse = await server.respond(request('/page?q=allowed'), { ...address, emulator });
	expect(await pageResponse.json()).toEqual({
		platform: { config: { inherited: true, message: 'page' }, prerender: true },
		query: 'allowed'
	});
	const api = await server.respond(request('/api'), { ...address, emulator });
	expect(await api.json()).toEqual({ config: { message: 'endpoint' }, prerender: 'auto' });
	const missing = await server.respond(request('/missing'), { ...address, emulator });
	expect(await missing.json()).toEqual({ config: {}, prerender: false });
});

it('embeds service worker registration and its options in CSP-authorized document code', async () => {
	const app = manifest();
	app.client = {
		start: '/start.js',
		imports: [],
		stylesheets: [],
		fonts: [],
		uses_env_dynamic_public: false
	};
	app.nodes[2] = async () => node(2, { ssr: false });
	app.routes = [route('/', null, true)];
	const config = options();
	app.client.inline = { script: '__sveltekit_contract.app={init(){},start(){}}', style: undefined };
	config.serviceWorker = { file: 'service-worker.js', options: { updateViaCache: 'imports' } };
	config.csp = { mode: 'hash', directives: { 'default-src': ['self'] } };
	const server = await start(app, config);
	const response = await server.respond(request(), address);
	const html = await response.text();
	const script = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
		.map((match) => match[1]!)
		.find((script) => script.includes('navigator.serviceWorker.register'))!;
	let register: (() => void) | undefined;
	let registered: unknown[] = [];
	await runInNewContext(script, {
		document: { currentScript: { parentElement: {} } },
		addEventListener: (name: string, handler: () => void) => {
			if (name === 'load') register = handler;
		},
		navigator: {
			serviceWorker: {
				register: (...args: unknown[]) => {
					registered = args;
				}
			}
		}
	});
	register!();
	expect(registered).toEqual(['/service-worker.js', { updateViaCache: 'imports', type: 'module' }]);
	expect(response.headers.get('content-security-policy')).toContain(
		`'sha256-${await sha256(script)}'`
	);
});

it('normalizes page slashes and answers conditional requests without a response body', async () => {
	const app = manifest();
	app.nodes[2] = async () =>
		node(2, { trailingSlash: 'always', load: () => ({ layout: 'page' }) }, undefined, layout);
	app.routes = [route('/page', null, true)];
	const server = await start(app, options());
	const redirect = await server.respond(
		request('/page', { headers: { accept: 'text/html' } }),
		address
	);
	expect(redirect.status).toBe(308);
	expect(redirect.headers.get('location')).toBe('/page/');
	expect(redirect.headers.get('x-sveltekit-normalize')).toBe('1');
	await redirect.body?.cancel();
	const document = await server.respond(
		request('/page/', { headers: { accept: 'text/html' } }),
		address
	);
	const etag = document.headers.get('etag')!;
	await document.text();
	const cached = await server.respond(
		request('/page/', { headers: { accept: 'text/html', 'if-none-match': etag } }),
		address
	);
	expect(cached.status).toBe(304);
	expect(cached.body).toBeNull();
});

it('reads imported and inline assets through the supplied Web-stream reader', async () => {
	const app = manifest();
	app.server_assets = new Proxy(
		{},
		{
			has: (_, file) => file === 'asset.txt' || file === '/@fs/root/[asset].txt',
			get: () => 5
		}
	);
	app.routes = [
		route('/', async () => ({
			GET: async () =>
				Response.json({
					imported: await read('/asset.txt').text(),
					filesystem: await read('/@fs/root/%5Basset%5D.txt').text(),
					inline: await read('data:text/plain;base64,aGVsbG8=').text()
				})
		}))
	];
	const config = options();
	config.dev = true;
	const server = await start(app, config, {
		env: {},
		read: (file) =>
			file === 'asset.txt' || file === '/@fs/root/[asset].txt' ? new Blob(['hello']).stream() : null
	});
	const response = await server.respond(request(), address);
	expect(await response.json()).toEqual({
		imported: 'hello',
		filesystem: 'hello',
		inline: 'hello'
	});
});
