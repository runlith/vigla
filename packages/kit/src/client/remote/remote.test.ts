import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { stringify } from 'devalue';
import { effect, mount, root, unmount, type Owner } from 'vigla';
import { render } from 'vigla/server';
import {
	hydrated as serverHydrated,
	openHydration as openServerInput
} from 'vigla/internal/index-server';
import type { ClientApp } from '../../types/internal/client.ts';
import type { RemoteData } from '../../types/internal/remote.ts';
import { decodeArgument, encodeArgument, getRemoteKey } from '../../shared/remote.ts';
import { serialize } from '../../shared/serialization.ts';
import { deserializeBinaryForm, BINARY_FORM_CONTENT_TYPE } from '../../shared/form-data.ts';
import {
	query,
	query_batch,
	query_live,
	command,
	form,
	prerender
} from '../../entries/internal/client.ts';
import { Client } from '../client.ts';
import { init } from '../payload.ts';

let runtime: Client;
const roots: Owner[] = [];

function app(): ClientApp {
	return {
		global: '__remote_test',
		nodes: [
			async () => ({ component: () => {} }),
			async () => ({ component: () => {} }),
			async () => ({ component: () => {}, universal: { load: () => ({}) } })
		],
		serverLoads: [],
		dictionary: { '/': [2, []] },
		matchers: {},
		hooks: {},
		root: () => ({}),
		encoders: {},
		decoders: {}
	};
}
function response(data: RemoteData): Response {
	return Response.json({ type: 'result', data: stringify(data) });
}
function owner(): Owner {
	const value = root();
	roots.push(value);
	return value;
}
function connect(value: ReturnType<typeof form>): { element: HTMLFormElement; detach: () => void } {
	const element = document.createElement('form');
	element.method = value.method;
	element.action = value.action;
	document.body.append(element);
	const key = Reflect.ownKeys(value).find((key) => typeof key === 'symbol')!;
	const detach = (value[key as symbol] as (element: HTMLFormElement) => () => void)(element);
	return { element, detach };
}

beforeEach(() => {
	document.body.innerHTML = '<main></main><section></section>';
	history.replaceState(null, '', '/');
	init({ app_dir: '_app', version: 'remote-test' });
	vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
	runtime = new Client(app(), document.querySelector('main')!);
});
afterEach(() => {
	for (const value of roots.splice(0)) value.dispose();
	runtime.dispose();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

test('a detached owner retains a query after component unmount, and its disposal releases the entry', async () => {
	let generation = 0;
	vi.stubGlobal('fetch', async () => response({ _: ++generation }));
	const read = query<void, number>('hash/owned');
	const service = owner();
	const held = service.run(() => read());
	const component = runtime.owner.run(() =>
		mount(
			(anchor) => {
				const value = read();
				const text = document.createTextNode('');
				anchor.parentNode!.insertBefore(text, anchor);
				effect(() => {
					text.data = String(value.current);
				});
				return {};
			},
			{ target: document.querySelector('section')! }
		)
	);
	await expect(held).resolves.toBe(1);
	await unmount(component);
	await held.refresh();
	expect(await read()).toBe(2);
	service.dispose();
	expect(await read()).toBe(3);
	expect(await read()).toBe(4);
});

test('server-load and fallback-form snapshots hydrate through the tab owner while a new client key fetches', async () => {
	class Value {
		readonly count: number;
		constructor(count: number) {
			this.count = count;
		}
	}
	const transport = {
		Value: {
			encode: (value: unknown) => value instanceof Value && [value.count],
			decode: (value: number[]) => new Value(value[0]!)
		}
	};
	const read = query<string, Value>('hash/hydrated');
	const key = getRemoteKey('hash/hydrated', encodeArgument('server', transport));
	const request = owner();
	const load = () => serverHydrated(key, async () => serialize({ v: new Value(7) }, transport));
	request.run(() => {
		openServerInput();
		load();
		serverHydrated('hash/fallback/"item"', () =>
			serialize(
				{
					v: {
						input: { name: 'previous' },
						issues: [{ name: 'name', path: ['name'], message: 'required', server: true }],
						result: 'retained'
					}
				},
				transport
			)
		);
	});
	const format = { global: '__remote_hydration', meta: '__remote_meta', cssWrapper: 'remote' };
	const output = await request.run(() => render(() => {}, { format }));
	request.dispose();
	const scripts = document.createElement('div');
	scripts.innerHTML = output.head;
	for (const script of scripts.querySelectorAll('script')) window.eval(script.textContent!);
	let requests = 0;
	vi.stubGlobal('fetch', async () => {
		requests++;
		return response({ _: 9 });
	});
	runtime.dispose();
	const application = app();
	application.format = format;
	application.hooks.transport = transport;
	application.encoders = { Value: transport.Value.encode };
	application.decoders = { Value: transport.Value.decode };
	const seen: unknown[] = [];
	application.hooks.init = async () => {
		seen.push(await read('server'));
		seen.push(await query<void, number>('hash/client')());
		const fallback = form('hash/fallback').for('item');
		seen.push(fallback.fields.name!.value(), fallback.fields.allIssues(), fallback.result);
	};
	runtime = new Client(application, document.querySelector('main')!);
	await runtime.start();
	expect(seen).toEqual([
		new Value(7),
		9,
		'previous',
		[{ path: ['name'], message: 'required' }],
		'retained'
	]);
	expect(seen[0]).toBeInstanceOf(Value);
	expect(requests).toBe(1);
	delete (window as unknown as Record<string, unknown>)[format.global];
});

test('batch queries deduplicate equal payloads into one microtask request', async () => {
	const requests: string[][] = [];
	vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
		const body = JSON.parse(init.body as string) as { payloads: string[] };
		requests.push(body.payloads);
		return response({
			_: body.payloads.map((payload) => ({
				type: 'result',
				data: Number(decodeArgument(payload)) * 2
			}))
		});
	});
	const read = query_batch<number, number>('hash/batch');
	const service = owner();
	const [first, duplicate, second] = service.run(() => [read(2), read(2), read(3)]);
	expect(await Promise.all([first, duplicate, second])).toEqual([4, 4, 6]);
	expect(requests).toEqual([[encodeArgument(2), encodeArgument(3)]]);
});

test('command refreshes reconcile optimistic overrides and release them on failures', async () => {
	const replies: PromiseWithResolvers<Response>[] = [];
	vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
		if (init?.method !== 'POST') return response({ _: 1 });
		const reply = Promise.withResolvers<Response>();
		replies.push(reply);
		return reply.promise;
	});
	const read = query<void, number>('hash/count');
	const value = owner().run(() => read());
	await value;
	const mutate = command<void, string>('hash/change');
	const pending = mutate().updates(value.withOverride((old) => old + 10));
	expect(value.current).toBe(11);
	expect(mutate.pending).toBe(1);
	await vi.waitFor(() => expect(replies).toHaveLength(1));
	replies[0]!.resolve(
		response({ _: 'saved', q: { [getRemoteKey('hash/count', '')]: { v: 2 } }, r: true })
	);
	await expect(pending).resolves.toBe('saved');
	expect(value.current).toBe(2);
	expect(mutate.pending).toBe(0);
	const failed = mutate().updates(value.withOverride((old) => old + 20));
	await vi.waitFor(() => expect(replies).toHaveLength(2));
	replies[1]!.resolve(
		Response.json({ type: 'error', error: { status: 400, message: 'refused' } }, { status: 400 })
	);
	await expect(failed).rejects.toMatchObject({ status: 400, body: { message: 'refused' } });
	expect(value.current).toBe(2);
	expect(mutate.pending).toBe(0);
});

test('each optimistic layer releases independently when the same update function is reused', () => {
	const value = owner().run(() => query<void, number>('hash/layers')());
	value.set(1);
	const update = (value: number) => value + 1;
	const first = value.withOverride(update);
	const second = value.withOverride(update);
	expect(value.current).toBe(3);
	first();
	expect(value.current).toBe(2);
	second();
	expect(value.current).toBe(1);
});

test('set and a later refresh supersede older in-flight responses', async () => {
	const replies: PromiseWithResolvers<Response>[] = [];
	vi.stubGlobal('fetch', () => {
		const reply = Promise.withResolvers<Response>();
		replies.push(reply);
		return reply.promise;
	});
	const value = owner().run(() => query<void, number>('hash/race')());
	const initial = value.then();
	await vi.waitFor(() => expect(replies).toHaveLength(1));
	value.set(4);
	await expect(initial).resolves.toBe(4);
	replies[0]!.resolve(response({ _: 1 }));
	const earlier = value.refresh();
	const later = value.refresh();
	await vi.waitFor(() => expect(replies).toHaveLength(3));
	replies[2]!.resolve(response({ _: 6 }));
	await later;
	replies[1]!.resolve(response({ _: 5 }));
	await earlier;
	expect(value.current).toBe(6);
});

test('disposing the tab aborts a pending one-shot query and settles its result', async () => {
	const started = Promise.withResolvers<void>();
	let signal: AbortSignal | undefined;
	vi.stubGlobal(
		'fetch',
		(_url: string, init: RequestInit) =>
			new Promise<Response>((_resolve, reject) => {
				signal = init.signal!;
				signal.addEventListener('abort', () => reject(signal!.reason), { once: true });
				started.resolve();
			})
	);
	const pending = query<void, number>('hash/cancel')().then();
	await started.promise;
	runtime.dispose();
	await expect(pending).rejects.toMatchObject({ body: { message: 'Remote client disposed' } });
	expect(signal?.aborted).toBe(true);
});

test('live queries share their stream, reconnect after transport loss, and abort on owner disposal', async () => {
	vi.useFakeTimers();
	const streams: ReadableStreamDefaultController<Uint8Array>[] = [];
	const aborted: boolean[] = [];
	vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
		const index = streams.length;
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				streams.push(controller);
				init.signal!.addEventListener(
					'abort',
					() => {
						aborted[index] = true;
						try {
							controller.error(new DOMException('Aborted', 'AbortError'));
						} catch {}
					},
					{ once: true }
				);
			}
		});
		return new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
	});
	const service = owner();
	const value = service.run(() => query_live<void, number>('hash/live')());
	const iterator = value[Symbol.asyncIterator]();
	const first = iterator.next();
	await vi.advanceTimersByTimeAsync(0);
	const text = new TextEncoder();
	streams[0]!.enqueue(
		text.encode(`data: ${JSON.stringify({ type: 'result', result: stringify(1) })}\n\n`)
	);
	await expect(first).resolves.toEqual({ value: 1, done: false });
	const ready = value.then();
	await vi.advanceTimersByTimeAsync(1);
	expect(await ready).toBe(1);
	streams[0]!.error(new TypeError('connection lost'));
	await vi.advanceTimersByTimeAsync(400);
	expect(streams).toHaveLength(2);
	const next = iterator.next();
	streams[1]!.enqueue(
		text.encode(`data: ${JSON.stringify({ type: 'result', result: stringify(2) })}\n\n`)
	);
	await expect(next).resolves.toEqual({ value: 2, done: false });
	expect(value.current).toBe(2);
	service.dispose();
	expect(aborted[1]).toBe(true);
	await expect(iterator.next()).resolves.toMatchObject({ done: true });
});

test('remote forms project fields, validate preflight, and send keyed binary submissions with refreshes', async () => {
	const read = query<void, number>('hash/formQuery');
	const value = owner().run(() => read());
	let submitted: Record<string, any> | undefined;
	vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
		if (!init?.body) return response({ _: 1 });
		const reader = new FileReader();
		const bytes = new Promise<ArrayBuffer>((resolve, reject) => {
			reader.onload = () => resolve(reader.result as ArrayBuffer);
			reader.onerror = reject;
		});
		reader.readAsArrayBuffer(init.body as Blob);
		const decoded = await deserializeBinaryForm(
			new Request('http://localhost/', {
				method: 'POST',
				headers: { 'content-type': BINARY_FORM_CONTENT_TYPE },
				body: await bytes
			}),
			'hash/save'
		);
		submitted = decoded.data;
		expect(decoded.meta.remote_refreshes).toEqual([getRemoteKey('hash/formQuery', '')]);
		return response({
			_: { result: 'saved' },
			q: { [getRemoteKey('hash/formQuery', '')]: { v: 8 } },
			r: true
		});
	});
	await value;
	const save = form('hash/save');
	const instance = owner().run(() => save.for('item'));
	instance.preflight({
		'~standard': {
			version: 1,
			vendor: 'test',
			validate: (input: any) =>
				input.name === 'ok'
					? { value: input }
					: { issues: [{ message: 'required', path: ['name'] }] }
		}
	});
	const { element, detach } = connect(instance as ReturnType<typeof form>);
	const field = instance.fields.name!.as('text');
	const input = document.createElement('input');
	input.name = field.name;
	element.append(input);
	await expect(instance.submit().updates()).resolves.toBe(false);
	expect(instance.fields.allIssues()).toEqual([{ path: ['name'], message: 'required' }]);
	input.value = 'ok';
	input.dispatchEvent(new Event('input', { bubbles: true }));
	input.dispatchEvent(new Event('focusout', { bubbles: true }));
	expect(instance.fields.name!.value()).toBe('ok');
	expect(instance.fields.name!.dirty()).toBe(true);
	expect(instance.fields.name!.touched()).toBe(true);
	await expect(instance.submit().updates(value)).resolves.toBe(true);
	expect(submitted).toEqual({ name: 'ok', id: 'item' });
	expect(instance.result).toBe('saved');
	expect(value.current).toBe(8);
	expect(instance.pending).toBe(0);
	expect(new URL(instance.action, location.href).searchParams.get('/remote')).toBe(
		'hash/save/"item"'
	);
	detach();
});

test('enhanced forms intercept their own action and expose the submitted element and result', async () => {
	vi.stubGlobal('fetch', async () => response({ _: { result: 12 } }));
	const completed = Promise.withResolvers<boolean>();
	const save = form('hash/enhanced');
	const attributes = save.enhance(async (instance) => {
		expect(instance.element).toBe(element);
		completed.resolve(await instance.submit().updates());
	});
	const { element, detach } = connect(attributes as ReturnType<typeof form>);
	const input = document.createElement('input');
	input.name = save.fields.name!.as('text').name;
	input.value = 'value';
	const button = document.createElement('button');
	button.type = 'submit';
	element.append(input, button);
	const submit = new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: button });
	element.dispatchEvent(submit);
	expect(submit.defaultPrevented).toBe(true);
	await expect(completed.promise).resolves.toBe(true);
	expect(save.result).toBe(12);
	button.setAttribute('formaction', '/other');
	const other = new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: button });
	element.dispatchEvent(other);
	expect(other.defaultPrevented).toBe(false);
	detach();
});

test('prerender results use the encoded path and remain stable while an owner holds them', async () => {
	const urls: string[] = [];
	vi.stubGlobal('fetch', async (url: string) => {
		urls.push(url);
		return response({ _: { value: 3 } });
	});
	const read = prerender<string, { value: number }>('hash/static');
	const service = owner();
	const value = service.run(() => read('a'));
	await expect(value).resolves.toEqual({ value: 3 });
	await expect(service.run(() => read('a'))).resolves.toEqual({ value: 3 });
	expect(urls).toEqual([`/_app/remote/hash/static/${encodeArgument('a')}`]);
});
