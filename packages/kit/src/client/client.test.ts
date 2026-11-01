// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { stringify } from 'devalue';
import {
	effect,
	getContext,
	getOwner,
	hydratable,
	onDestroy,
	root as ownerRoot,
	setContext,
	type Owner
} from 'vigla';
import { render } from 'vigla/server';
import {
	hydratable as serverHydratable,
	openHydration as openServerInput
} from 'vigla/internal/index-server';
import type { ClientApp, ClientNode, RootProps } from '../types/internal/client.ts';
import { start } from './entry.ts';
import {
	goto,
	invalidate,
	preloadCode,
	preloadData,
	beforeNavigate,
	afterNavigate,
	onNavigate,
	snapshot,
	refreshAll,
	pushState,
	replaceState
} from '../entries/app/navigation/client.ts';
import { page, navigating, updated } from '../entries/app/state/client.ts';
import { applyAction, deserialize, enhance } from '../entries/app/forms/client.ts';
import { resolve, asset } from '../entries/app/paths/client.ts';
import { init } from './payload.ts';
import { redirect } from '../entries/index.ts';

let owner: Owner;
const key = {};
let mountedContext: unknown;
function root(anchor: ChildNode, props: RootProps): Record<string, unknown> {
	mountedContext = getContext(key);
	const element = document.createElement('p');
	anchor.parentNode!.insertBefore(element, anchor);
	effect(() => {
		element.textContent = String(props.page.data.value ?? props.page.status);
	});
	return {};
}

function fixture(load: NonNullable<ClientNode['universal']>['load']): ClientApp {
	init({ version: 'one' });
	return {
		global: '__sveltekit_test',
		nodes: [
			async () => ({ component: () => {} }),
			async () => ({ component: () => {} }),
			async () => ({ component: () => {}, universal: { load } })
		],
		serverLoads: [],
		dictionary: { '/[id]': [2, []] },
		matchers: {},
		root,
		encoders: {},
		decoders: {},
		hooks: {
			init() {
				owner = getOwner()!;
				setContext(key, 'tab');
			}
		}
	};
}

beforeEach(() => {
	document.body.innerHTML = '<main></main>';
	history.replaceState(null, '', '/one');
	vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
	Element.prototype.scrollIntoView = () => {};
	init({});
});

afterEach(() => {
	vi.unstubAllGlobals();
	owner?.dispose();
	vi.restoreAllMocks();
	vi.useRealTimers();
});

test('startup owns init, initial loads and the mounted app, queues goto and preloads code without data', async () => {
	const seen: unknown[] = [];
	const loaded: string[] = [];
	const app = fixture(({ params }) => {
		seen.push(getOwner(), getContext(key));
		loaded.push(params.id!);
		return { value: params.id };
	});
	let queued!: Promise<void>;
	app.hooks.init = async () => {
		owner = getOwner()!;
		setContext(key, 'tab');
		afterNavigate((navigation) => seen.push(navigation.type));
		await preloadCode('/[id]');
		expect(loaded).toEqual([]);
		queued = goto('/two');
	};
	await start(app, document.querySelector('main')!);
	await queued;
	expect(seen).toEqual([owner, 'tab', 'enter', owner, 'tab', 'goto']);
	expect(mountedContext).toBe('tab');
	expect(page.url.pathname).toBe('/two');
	expect(document.querySelector('main p')?.textContent).toBe('two');
	let destroyed = false;
	owner.run(() =>
		onDestroy(() => {
			destroyed = true;
		})
	);
	owner.dispose();
	expect(destroyed).toBe(true);
});

test('request hydratable values reach init and initial loads with the app format, then close', async () => {
	const format = {
		global: '__client_test_data',
		meta: '__client_test_meta',
		cssWrapper: 'client-test-wrap'
	};
	const request = ownerRoot();
	request.run(() => {
		openServerInput();
		serverHydratable('request', () => ({ version: 7 }));
	});
	const rendered = await request.run(() => render(() => {}, { format }));
	request.dispose();
	const scripts = document.createElement('div');
	scripts.innerHTML = rendered.head;
	for (const script of scripts.querySelectorAll('script')) window.eval(script.textContent!);
	const seen: unknown[] = [];
	const app = fixture(() => ({ value: hydratable('request', () => ({ version: -1 })) }));
	app.format = format;
	app.hooks.init = () => {
		owner = getOwner()!;
		seen.push(hydratable('request', () => null));
	};
	await start(app, document.querySelector('main')!);
	expect(seen).toEqual([{ version: 7 }]);
	expect(page.data.value).toEqual({ version: 7 });
	expect(owner.run(() => hydratable('request', () => 'closed'))).toBe('closed');
	delete (globalThis as Record<string, unknown>)[format.global];
});

test('a failed error component uses the static error template with an escaped message', async () => {
	const app = fixture(() => {
		throw new Error('page failed');
	});
	app.nodes[1] = async () => {
		throw new Error('error component failed');
	};
	app.hooks.handleError = () => ({ status: 500, message: '<failure>' });
	app.errorTemplate =
		async () =>
		({ status, message }) =>
			`<html><head></head><body><p>${status}:${message}</p></body></html>`;
	await expect(start(app, document.querySelector('main')!)).rejects.toThrow(
		'error component failed'
	);
	expect(document.querySelector('p')?.textContent).toBe('500:<failure>');
	expect(document.querySelector('failure')).toBe(null);
	expect(owner.disposed).toBe(true);
});

test('loads reuse tracked dependencies, invalidate selectively, and transfer a data preload to navigation', async () => {
	let count = 0;
	const app = fixture(({ depends, params, url }) => {
		depends('custom:value');
		return { value: `${params.id}:${url.searchParams.get('q')}:${++count}` };
	});
	await start(app, document.querySelector('main')!);
	await goto('/one?ignored=yes');
	expect(page.data.value).toBe('one:null:1');
	await invalidate('custom:other');
	expect(page.data.value).toBe('one:null:1');
	await invalidate('custom:value');
	expect(page.data.value).toBe('one:null:2');
	const preloaded = await preloadData('/two?q=x');
	expect(preloaded).toEqual({ type: 'loaded', status: 200, data: { value: 'two:x:3' } });
	await goto('/two?q=x');
	expect(page.data.value).toBe('two:x:3');
});

test('navigation can be cancelled or awaited, publishes navigating and finishes after DOM changes', async () => {
	const app = fixture(({ params }) => ({ value: params.id }));
	const events: unknown[] = [];
	let release!: () => void;
	app.hooks.init = () => {
		owner = getOwner()!;
		beforeNavigate((event) => {
			if (event.to?.url.pathname === '/blocked') event.cancel();
		});
		onNavigate(
			() =>
				new Promise<() => void>((resolve) => {
					release = () => resolve(() => events.push(document.querySelector('main p')?.textContent));
				})
		);
		afterNavigate((event) => events.push(event.type));
	};
	await start(app, document.querySelector('main')!);
	await goto('/blocked');
	expect(page.url.pathname).toBe('/one');
	const moving = goto('/two');
	await vi.waitFor(() => expect(navigating.type).toBe('goto'));
	await vi.waitFor(() => expect(release).toBeTypeOf('function'));
	expect(page.url.pathname).toBe('/one');
	release();
	await moving;
	expect(events).toEqual(['enter', 'two', 'goto']);
	expect(navigating.type).toBe(null);
});

test('hydration reruns universal load with replayed server fetch and decoded action data', async () => {
	const response = document.createElement('script');
	response.type = 'application/json';
	response.setAttribute('data-sveltekit-fetched', '');
	response.setAttribute('data-url', '/api');
	response.textContent = JSON.stringify({
		body: '{"value":4}',
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
	document.body.append(response);
	const app = fixture(async ({ data, fetch }) => ({
		value: data!.base + (await (await fetch('/api')).json()).value
	}));
	await start(app, document.querySelector('main')!, () => ({
		node_ids: [0, 2],
		data: [null, { type: 'data', data: { base: 3 }, uses: {} }],
		params: { id: 'one' },
		route: { id: '/[id]' },
		form: null,
		error: null
	}));
	expect(page.data.value).toBe(7);
	expect(response.isConnected).toBe(false);
	const result = deserialize(
		JSON.stringify({
			type: 'failure',
			status: 422,
			location: '/one',
			data: stringify({ field: 'invalid' })
		})
	);
	await applyAction(result);
	expect(page.form).toEqual({ field: 'invalid' });
	expect(page.status).toBe(422);
});

test('boot and streamed transport decoders wait for init and run under the tab owner', async () => {
	const seen: unknown[] = [];
	const app = fixture(async ({ data }) => ({ value: data!.inline + (await data!.deferred) }));
	const global = init({ version: 'one' });
	app.decoders.Context = (value) => {
		seen.push(getOwner(), getContext(key));
		return value;
	};
	app.decode = (name, value) => app.decoders[name]!(value);
	const hook = Promise.withResolvers<void>();
	app.hooks.init = () => {
		owner = getOwner()!;
		setContext(key, 'tab');
		return hook.promise;
	};
	global.resolve(1, (module) => [module.decode!('Context', 5)]);
	const starting = start(app, document.querySelector('main')!, () => ({
		node_ids: [0, 2],
		data: [
			null,
			{
				type: 'data',
				data: { inline: app.decode!('Context', 2), deferred: global.defer(1) },
				uses: {}
			}
		],
		params: { id: 'one' },
		route: { id: '/[id]' },
		form: null,
		error: null
	}));
	expect(seen).toEqual([]);
	hook.resolve();
	await starting;
	expect(page.data.value).toBe(7);
	expect(seen).toEqual([owner, 'tab', owner, 'tab']);
	const later = global.defer(2);
	global.resolve(2, (module) => [module.decode!('Context', 8)]);
	await expect(later).resolves.toBe(8);
	const failed = global.defer(3);
	global.resolve(3, () => [undefined, { status: 403, message: 'denied' }]);
	await expect(failed).rejects.toEqual({ status: 403, message: 'denied' });
});

test('NDJSON and form data codecs create state under the tab owner', async () => {
	const marker = {};
	const encoded = JSON.parse(
		stringify({ value: marker }, { Context: (value) => (value === marker ? 'native' : false) })
	);
	const app = fixture(({ data }) => ({ value: data!.value }));
	app.dictionary = { '/[id]': [~2, []] };
	app.decoders.Context = (value) => ({ value, owner: getOwner(), context: getContext(key) });
	vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
		const url = new URL(input instanceof Request ? input.url : input, location.href);
		if (
			url.pathname !== '/one/__data.json' ||
			url.searchParams.get('x-sveltekit-invalidated') !== '01'
		)
			return new Response(null, { status: 404 });
		return new Response(
			JSON.stringify({ type: 'data', nodes: [null, { type: 'data', data: encoded, uses: {} }] })
		);
	});
	await start(app, document.querySelector('main')!);
	expect(page.data.value).toEqual({ value: 'native', owner, context: 'tab' });
	const result = deserialize(
		JSON.stringify({
			type: 'failure',
			status: 422,
			location: '/one',
			data: stringify(
				{ value: marker },
				{ Context: (value) => (value === marker ? 'form' : false) }
			)
		})
	);
	if (result.type !== 'failure') throw new Error('Expected failure');
	expect(result.data?.value).toEqual({ value: 'form', owner, context: 'tab' });
});

test('enhanced actions preserve native submitter data, update form status and notify deployments', async () => {
	const app = fixture(() => ({ value: 1 }));
	await start(app, document.querySelector('main')!);
	const form = document.createElement('form');
	form.method = 'post';
	form.innerHTML =
		'<input name="name" value="Ada"><button name="submit" value="save">save</button>';
	document.body.append(form);
	vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
		const body = init!.body as URLSearchParams;
		return new Response(
			JSON.stringify({
				type: 'failure',
				status: 422,
				location: '/one',
				data: JSON.stringify([{ submitted: 1 }, body.get('name') + ':' + body.get('submit')])
			}),
			{ status: 422, headers: { 'x-sveltekit-version': 'two' } }
		);
	});
	const enhancement = enhance(form);
	form.dispatchEvent(
		new SubmitEvent('submit', {
			bubbles: true,
			cancelable: true,
			submitter: form.querySelector('button')!
		})
	);
	await vi.waitFor(() => expect(page.status).toBe(422));
	expect(page.form).toEqual({ submitted: 'Ada:save' });
	expect(updated.current).toBe(true);
	enhancement.destroy();
});

test('hash routing path resolution omits base and assets retain their configured origin', async () => {
	const app = fixture(() => ({ value: 1 }));
	init({ hash: true, base: '/base', assets: 'https://cdn.test/assets' });
	expect(resolve('before-start')).toBe('#/before-start');
	history.replaceState(null, '', '/base/#/one');
	await start(app, document.querySelector('main')!);
	expect(resolve('about')).toBe('#/about');
	expect(resolve('/blog/[slug]', { slug: 'hello' })).toBe('#/blog/hello');
	expect(asset('photo.jpg')).toBe('https://cdn.test/assets/photo.jpg');
});

test('beforeNavigate can cancel a native external link before the document unloads', async () => {
	const app = fixture(() => ({ value: 'one' }));
	app.hooks.init = () => {
		owner = getOwner()!;
		beforeNavigate((navigation) => {
			if (navigation.to?.url.origin === 'https://outside.test' && navigation.willUnload)
				navigation.cancel();
		});
	};
	await start(app, document.querySelector('main')!);
	const anchor = document.createElement('a');
	anchor.href = 'https://outside.test/';
	document.body.append(anchor);
	expect(
		anchor.dispatchEvent(
			new MouseEvent('click', { bubbles: true, composed: true, cancelable: true })
		)
	).toBe(false);
	expect(page.url.pathname).toBe('/one');
});

test('inherited link preloading transfers its data and reset false preserves focus', async () => {
	vi.useFakeTimers();
	let count = 0;
	const app = fixture(({ params }) => ({ value: `${params.id}:${++count}` }));
	const complete = Promise.withResolvers<void>();
	app.hooks.init = () => {
		owner = getOwner()!;
		afterNavigate((navigation) => {
			if (navigation.type === 'link') complete.resolve();
		});
	};
	await start(app, document.querySelector('main')!);
	const section = document.createElement('section');
	section.setAttribute('data-sveltekit-preload-data', 'hover');
	section.setAttribute('data-sveltekit-reset', 'false');
	section.innerHTML = '<input><a href="/two">two</a>';
	document.body.append(section);
	const input = section.querySelector('input')!;
	const anchor = section.querySelector('a')!;
	input.focus();
	anchor.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, composed: true }));
	await vi.advanceTimersByTimeAsync(20);
	expect(await preloadData('/two')).toEqual({
		type: 'loaded',
		status: 200,
		data: { value: 'two:2' }
	});
	anchor.click();
	await complete.promise;
	expect(page.data.value).toBe('two:2');
	expect(document.activeElement).toBe(input);
});

test('a superseded navigation cannot apply after its error component finishes loading', async () => {
	const delayed = Promise.withResolvers<ClientNode>();
	const entered = Promise.withResolvers<void>();
	const app = fixture(() => ({ value: 'one' }));
	app.nodes.push(async () => ({
		component: () => {},
		universal: { load: () => ({ value: 'slow' }) }
	}));
	app.nodes.push(() => delayed.promise);
	app.nodes.push(async () => ({
		component: () => {},
		universal: { load: () => ({ value: 'fast' }) }
	}));
	app.dictionary = { '/one': [2, []], '/slow': [3, [], [4]], '/fast': [5, []] };
	app.hooks.init = () => {
		owner = getOwner()!;
		onNavigate((navigation) => {
			if (navigation.to?.url.pathname === '/slow') entered.resolve();
		});
	};
	await start(app, document.querySelector('main')!);
	const slow = goto('/slow');
	await entered.promise;
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
	await goto('/fast');
	delayed.resolve({ component: () => {} });
	await slow;
	expect(page.url.pathname).toBe('/fast');
	expect(document.querySelector('main p')?.textContent).toBe('fast');
});

test('history traversal restores the rendered page behind a shallow destination', async () => {
	const app = fixture(({ params }) => ({ value: params.id }));
	let popped = Promise.withResolvers<void>();
	app.hooks.init = () => {
		owner = getOwner()!;
		afterNavigate((navigation) => {
			if (navigation.type === 'popstate') popped.resolve();
		});
	};
	await start(app, document.querySelector('main')!);
	await goto('/two', { shallow: true, state: { modal: true } });
	await goto('/three');
	history.back();
	await popped.promise;
	expect(page.url.pathname).toBe('/one');
	expect(page.data.value).toBe('one');
	expect(page.shallow?.url.pathname).toBe('/two');
	expect(page.state).toEqual({ modal: true });
	history.back();
	await vi.waitFor(() => expect(page.shallow).toBe(null));
	expect(page.url.pathname).toBe('/one');
});

test('snapshots restore on popstate and refresh preserves shallow page state', async () => {
	let draft = 'first';
	let registeredOwner: Owner | null = null;
	let capturedOwner: Owner | null = null;
	const app = fixture(({ params }) => ({ value: params.id }));
	const back = Promise.withResolvers<void>();
	app.hooks.init = () => {
		owner = getOwner()!;
		afterNavigate((navigation) => {
			if (navigation.type === 'popstate') back.resolve();
		});
	};
	app.root = (anchor, props) => {
		registeredOwner = getOwner();
		snapshot({
			id: 'draft',
			capture: () => {
				capturedOwner = getOwner();
				return draft;
			},
			restore: (value) => {
				draft = value;
			},
			reset: () => {
				draft = '';
			}
		});
		return root(anchor, props);
	};
	await start(app, document.querySelector('main')!);
	await goto('/two');
	expect(capturedOwner).toBe(registeredOwner);
	expect(draft).toBe('');
	draft = 'second';
	history.back();
	await back.promise;
	expect(draft).toBe('first');
	expect(page.url.pathname).toBe('/one');
	await goto('/two', { shallow: true, state: { open: true } });
	await refreshAll();
	expect(page.state).toEqual({ open: true });
	expect(page.shallow?.url.pathname).toBe('/two');
	await invalidate('custom:irrelevant');
	expect(page.state).toEqual({});
});

test('enter has no source and snapshots restore after navigation callbacks', async () => {
	let draft = 'saved';
	const order: string[] = [];
	const events: unknown[] = [];
	const app = fixture(({ params }) => ({ value: params.id }));
	app.hooks.init = () => {
		owner = getOwner()!;
		afterNavigate((event) => {
			events.push({ from: event.from?.url.pathname, scroll: event.to?.scroll });
			order.push('after');
		});
	};
	app.root = (anchor, props) => {
		snapshot({
			id: 'ordered',
			capture: () => draft,
			restore: (value) => {
				draft = value;
				order.push('restore');
			}
		});
		return root(anchor, props);
	};
	await start(app, document.querySelector('main')!);
	expect(events[0]).toEqual({ from: undefined, scroll: { x: 0, y: 0 } });
	await goto('/two');
	draft = 'other';
	order.length = 0;
	history.back();
	await vi.waitFor(() => expect(order).toEqual(['after', 'restore']));
	expect(draft).toBe('saved');
});

test('unchanged branch data keeps its identity and mutations of page.url do not redirect invalidation', async () => {
	const loaded: string[] = [];
	const app = fixture(({ depends, untrack, url }) => {
		depends('custom:stable');
		loaded.push(untrack(() => url.pathname));
		return { value: 'stable' };
	});
	await start(app, document.querySelector('main')!);
	const data = page.data;
	await goto('/two?unused=1');
	expect(page.data).toBe(data);
	Reflect.set(page.url, 'pathname', '/mutated');
	await invalidate('custom:stable');
	expect(loaded).toEqual(['/one', '/two']);
	expect(page.url.pathname).toBe('/two');
});

test('synchronous invalidations share one load while a later microtask and same-URL goto reload', async () => {
	let count = 0;
	const app = fixture(({ depends }) => {
		depends('custom:batch');
		return { value: count++ };
	});
	await start(app, document.querySelector('main')!);
	await Promise.all([
		invalidate('custom:batch'),
		invalidate('custom:batch'),
		Promise.resolve().then(() => invalidate('custom:batch'))
	]);
	expect(page.data.value).toBe(2);
	await goto('/one');
	expect(page.data.value).toBe(3);
});

test('a consumed preloaded redirect reloads the returning route without replacing the source entry', async () => {
	let resolved = false;
	const app = fixture(({ params }) => {
		if (params.id === 'target' && !resolved) redirect(307, '/resolve');
		if (params.id === 'resolve') {
			resolved = true;
			redirect(307, '/target');
		}
		return { value: params.id };
	});
	await start(app, document.querySelector('main')!);
	expect(await preloadData('/target')).toEqual({
		type: 'redirect',
		status: 307,
		location: '/resolve'
	});
	await goto('/target');
	expect(page.data.value).toBe('target');
	expect(owner.disposed).toBe(false);
	history.back();
	await vi.waitFor(() => expect(page.url.pathname).toBe('/one'));
});

test('legacy shallow state is detached and does not run navigation callbacks', async () => {
	const events: string[] = [];
	const app = fixture(({ params }) => ({ value: params.id }));
	app.hooks.init = () => {
		owner = getOwner()!;
		afterNavigate((event) => events.push(event.type));
	};
	await start(app, document.querySelector('main')!);
	const state = { nested: { count: 0 } };
	await pushState('/two', state);
	state.nested.count++;
	expect(page.state).toEqual({ nested: { count: 0 } });
	await replaceState('/three', { done: true });
	expect(page.url.pathname).toBe('/one');
	expect(page.shallow?.url.pathname).toBe('/three');
	expect(events).toEqual(['enter']);
});

test('action errors select a destination boundary before its page load and preserve HTTP error kinds', async () => {
	let props!: RootProps;
	const local = () => {};
	const app = fixture(() => ({ value: 'source' }));
	app.nodes[0] = async () => ({
		component: () => {},
		universal: { load: () => ({ layout: 'kept' }) }
	});
	app.nodes.push(async () => ({
		component: () => {},
		universal: {
			load: () => {
				throw new Error('unexpected page load');
			}
		}
	}));
	app.nodes.push(async () => ({ component: local }));
	app.dictionary = { '/one': [2, []], '/destination': [3, [undefined], [4]] };
	app.root = (anchor, value) => {
		props = value;
		return root(anchor, value);
	};
	await start(app, document.querySelector('main')!);
	const form = document.createElement('form');
	form.method = 'post';
	form.action = '/destination';
	form.innerHTML = '<button>submit</button>';
	document.body.append(form);
	const enhancement = enhance(form);
	const responses = [
		new Response(
			JSON.stringify({
				type: 'error',
				status: 403,
				location: '/destination',
				error: { status: 403, message: 'action denied' }
			}),
			{ status: 403 }
		),
		new Response(JSON.stringify({ message: 'forbidden' }), { status: 403 }),
		new Response('<p>gateway</p>', { status: 502, statusText: 'Bad Gateway' })
	];
	for (const [index, response] of responses.entries()) {
		vi.stubGlobal('fetch', async () => response);
		form.dispatchEvent(
			new SubmitEvent('submit', {
				bubbles: true,
				cancelable: true,
				submitter: form.querySelector('button')!
			})
		);
		const expected = ['action denied', 'forbidden', 'Bad Gateway'][index];
		await vi.waitFor(() => expect(page.error?.message).toBe(expected));
		expect(props.tree.child?.component).toBe(local);
		expect(props.tree.child?.data.layout).toBe('kept');
	}
	expect(page.url.pathname).toBe('/destination');
	expect(page.status).toBe(502);
	enhancement.destroy();
});

test('native fragment entries update page.url and traverse without navigation lifecycle callbacks', async () => {
	const events: string[] = [];
	const app = fixture(() => ({ value: 'page' }));
	app.hooks.init = () => {
		owner = getOwner()!;
		beforeNavigate(() => events.push('before'));
		afterNavigate((event) => events.push(event.type));
	};
	await start(app, document.querySelector('main')!);
	const link = document.createElement('a');
	link.href = '#section';
	link.setAttribute('data-sveltekit-reload', '');
	document.body.append(link);
	const index = history.state['sveltekit:metadata'].historyIndex;
	link.click();
	await vi.waitFor(() => {
		expect(location.hash).toBe('#section');
		expect(history.state['sveltekit:metadata'].historyIndex).toBe(index + 1);
		expect(page.url.hash).toBe('#section');
	});
	history.back();
	await vi.waitFor(() => expect(page.url.hash).toBe(''));
	expect(events).toEqual(['enter']);
});
