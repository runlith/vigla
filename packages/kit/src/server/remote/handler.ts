import type { ActionResult } from '../actions.ts';
import type { RemoteCall, RequestStore } from '../../types/internal/server.ts';
import type {
	RemoteData,
	RemoteExport,
	RemoteFormInstance,
	RemoteFormResult,
	RemoteFunction,
	RemoteResponse
} from '../../types/internal/remote.ts';
import { deserializeBinaryForm } from '../../shared/form-data.ts';
import { decodeArgument, splitRemoteKey } from '../../shared/remote.ts';
import { isForm } from '../../shared/http.ts';
import { HttpError, Redirect } from '../../shared/outcomes.ts';
import { serialize } from '../../shared/serialization.ts';
import { actionLocation } from '../actions.ts';
import { FrameworkError, handleError } from '../failure.ts';
import { runRequest } from '../scope.ts';
import { versionHeader } from '../headers.ts';
import { collect } from './collect.ts';
import { liveResponse } from './stream.ts';
import * as errors from './errors.ts';

const kinds = new Set(['query', 'query_batch', 'query_live', 'command', 'form', 'prerender']);

export function initRemote(value: unknown, id: string): void {
	const name = id.slice(id.indexOf('/') + 1);
	if (name === 'default') errors.defaultExport(id);
	if ((!value || typeof value !== 'object') && typeof value !== 'function')
		errors.invalidExport(id);
	const internals = (value as RemoteExport).__;
	if (!internals || !kinds.has(internals.type)) errors.invalidExport(id);
	internals.id = id;
	internals.name = name;
}

async function lookup(
	store: RequestStore,
	hash: string,
	name: string
): Promise<RemoteExport | undefined> {
	if (!Object.hasOwn(store.manifest.remotes, hash)) return;
	const module = await store.manifest.remotes[hash]!();
	return Object.hasOwn(module.default, name) ? module.default[name] : undefined;
}

function requested(store: RequestStore, keys: unknown): void {
	if (keys === undefined) return;
	if (!Array.isArray(keys) || keys.some((key) => typeof key !== 'string'))
		throw new HttpError({ status: 400, message: 'Bad Request' });
	for (const key of keys) {
		const { id, payload } = splitRemoteKey(key);
		let payloads = store.remote.requested.get(id);
		if (!payloads) store.remote.requested.set(id, (payloads = new Set()));
		payloads.add(payload);
	}
}

function method(store: RequestStore, type: string, expected: string): void {
	if (store.event.request.method !== expected)
		throw new FrameworkError(
			405,
			'Method Not Allowed',
			`\`${type}\` functions must be invoked via ${expected} request, not ${store.event.request.method}`
		);
}

function response(store: RequestStore, body: RemoteResponse, status = 200): Response {
	return Response.json(body, {
		status,
		headers: {
			...(!store.state.prerendering || body.type === 'error'
				? { 'cache-control': 'private, no-store' }
				: {}),
			...versionHeader(store.options)
		}
	});
}

export async function handleRemote(call: RemoteCall): Promise<Response> {
	const { store } = call;
	const fn = await lookup(store, call.id, call.name);
	if (!fn) throw new HttpError({ status: 404, message: 'Not Found' });
	const internals = fn.__;
	const invoke = (arg: unknown) => runRequest(store, () => (fn as RemoteFunction)(arg));
	try {
		const data: RemoteData = {};
		switch (internals.type) {
			case 'query_live': {
				method(store, 'query.live', 'GET');
				const payload = new URL(store.event.request.url).searchParams.get('payload');
				const result = liveResponse(
					store,
					internals,
					decodeArgument(payload, store.hooks.transport)
				);
				for (const [name, value] of Object.entries(versionHeader(store.options)))
					result.headers.set(name, value);
				return result;
			}
			case 'query_batch': {
				method(store, 'query.batch', 'POST');
				const input: unknown = await store.event.request.json();
				if (
					!input ||
					typeof input !== 'object' ||
					!('payloads' in input) ||
					!Array.isArray(input.payloads) ||
					input.payloads.some((value) => typeof value !== 'string')
				) {
					throw new HttpError({ status: 400, message: 'Bad Request' });
				}
				const payloads = input.payloads;
				data._ = await runRequest(store, () =>
					internals.run(payloads.map((value) => decodeArgument(value, store.hooks.transport)))
				);
				break;
			}
			case 'form': {
				method(store, 'form', 'POST');
				if (!isForm(store.event.request))
					throw new FrameworkError(
						415,
						'Unsupported Media Type',
						'`form` functions expect form-encoded data'
					);
				const form = await deserializeBinaryForm(store.event.request, internals.id);
				requested(store, form.meta.remote_refreshes);
				if (call.argument && !('id' in form.data))
					form.data.id = JSON.parse(decodeURIComponent(call.argument));
				const derived = { ...store, remote: { ...store.remote, mutation: true } };
				data._ = await runRequest(derived, () => internals.fn(form.data, form.meta, form.formData));
				if ((data._ as RemoteFormResult).issues)
					return response(store, { type: 'result', data: serialize(data, store.hooks.transport) });
				break;
			}
			case 'command': {
				method(store, 'command', 'POST');
				const input: unknown = await store.event.request.json();
				if (
					!input ||
					typeof input !== 'object' ||
					!('payload' in input) ||
					typeof input.payload !== 'string'
				)
					throw new HttpError({ status: 400, message: 'Bad Request' });
				requested(store, 'refreshes' in input ? input.refreshes : undefined);
				data._ = await invoke(decodeArgument(input.payload, store.hooks.transport));
				break;
			}
			case 'prerender':
				method(store, 'prerender', 'GET');
				data._ = await invoke(decodeArgument(call.argument ?? '', store.hooks.transport));
				break;
			case 'query':
				method(store, 'query', 'GET');
				data._ = await invoke(
					decodeArgument(
						new URL(store.event.request.url).searchParams.get('payload'),
						store.hooks.transport
					)
				);
		}
		return response(store, {
			type: 'result',
			data: serialize(await collect(store, data), store.hooks.transport)
		});
	} catch (error) {
		if (error instanceof Redirect) {
			const data = await collect(store, { redirect: error.location });
			return response(store, { type: 'result', data: serialize(data, store.hooks.transport) });
		}
		const transformed = await handleError(store, error);
		return response(
			store,
			{ type: 'error', error: transformed },
			store.state.prerendering ? transformed.status : 200
		);
	}
}

export async function handleFormPost(store: RequestStore, id: string): Promise<ActionResult> {
	const location = actionLocation(store.event.url);
	const [hash, name, ...rest] = id.split('/');
	let form = await lookup(store, hash ?? '', name ?? '');
	if (form?.__.type !== 'form') {
		store.event.setHeaders({ allow: 'GET' });
		return { type: 'error', location, error: new FrameworkError(405, 'Method Not Allowed') };
	}
	try {
		const key = rest.join('/');
		if (key)
			form = runRequest(store, () =>
				(form as RemoteFormInstance).for(JSON.parse(key))
			) as RemoteFormInstance;
		if (form.__.type !== 'form') throw new FrameworkError(400, 'Bad Request');
		const internals = form.__;
		const decoded = await deserializeBinaryForm(store.event.request, internals.id);
		if (key && !('id' in decoded.data)) decoded.data.id = JSON.parse(key);
		const derived = { ...store, remote: { ...store.remote, mutation: true } };
		await runRequest(derived, () => internals.fn(decoded.data, decoded.meta, decoded.formData));
		return { type: 'success', status: 200, location, data: undefined };
	} catch (error) {
		if (error instanceof Redirect)
			return { type: 'redirect', status: error.status, location: error.location };
		return { type: 'error', location, error };
	}
}
