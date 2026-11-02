import { getContext, getOwner, openHydration, root, setContext } from 'vigla';
import type { AsyncContext, RequestState, RequestStore } from '../types/internal/server.ts';
import type { RequestEvent } from '../types/request.ts';
import type { ParamValue } from '../types/params.ts';
import * as errors from './errors.ts';
import type { Server } from './index.ts';
import { publishSnapshots } from './remote/resource.ts';

const requestKey = Symbol('request');
const contexts = new Set<WeakRef<AsyncContext>>();
let synchronous: RequestStore | undefined;

export function registerContext(context: AsyncContext): void {
	for (const reference of contexts) {
		const existing = reference.deref();
		if (!existing) contexts.delete(reference);
		else if (existing === context) return;
	}
	contexts.add(new WeakRef(context));
}

export function findRequest(): RequestStore | undefined {
	if (synchronous?.state.active) return synchronous;
	if (getOwner()) {
		const store = getContext<RequestStore | undefined>(requestKey);
		if (store?.state.active) return store;
	}
	for (const reference of contexts) {
		const context = reference.deref();
		if (!context) {
			contexts.delete(reference);
			continue;
		}
		const store = context.getStore();
		if (store?.state.active) return store;
	}
	return undefined;
}

export function getRequestStore(): RequestStore {
	return findRequest() ?? errors.request_store_after_await();
}

export function getRequestEvent(): RequestEvent<Record<string, ParamValue>> {
	const store = findRequest();
	if (store) return store.event;
	if (contexts.size) return errors.request_event_unavailable();
	return errors.request_event_after_await();
}

export function getRequestOwner(): RequestStore['owner'] {
	return getRequestStore().owner;
}

export function bindRequest(store: RequestStore): void {
	store.owner.run(() => {
		setContext(requestKey, store);
		openHydration({ format: store.options.format, beforeSnapshot: () => publishSnapshots(store) });
	});
}

export function requestContext(store: RequestStore): Map<unknown, unknown> {
	return new Map([[requestKey, store]]);
}

export function runRequest<T>(store: RequestStore, fn: () => T, context?: AsyncContext): T {
	const previous = synchronous;
	synchronous = store;
	try {
		return store.owner.run(() => (context ? context.run(store, fn) : fn()));
	} finally {
		synchronous = previous;
	}
}

export class RequestScope {
	readonly store: RequestStore;
	readonly #context?: AsyncContext;
	readonly #signal: AbortSignal;
	#closed = false;
	#abortBody: (() => void) | null = null;

	constructor(
		server: Server,
		event: RequestEvent<Record<string, ParamValue>>,
		state: RequestState,
		context?: AsyncContext
	) {
		this.#context = context;
		this.#signal = event.request.signal;
		this.store = {
			event,
			state,
			owner: root(),
			manifest: server.manifest,
			options: server.options,
			environment: server.environment,
			hooks: server.hooks,
			tracer: server.tracer,
			scope: context,
			remote: {
				cache: new Map(),
				forms: new Map(),
				formValues: new Map(),
				batches: new Map(),
				live: new Map(),
				explicit: new Map(),
				implicit: new Map(),
				requested: new Map(),
				ignored: new Set(),
				hydration: new Set(),
				snapshots: new Map(),
				query: false,
				prerender: false,
				mutation: false
			}
		};
		bindRequest(this.store);
		this.#signal.addEventListener('abort', this.#abort, { once: true });
		if (this.#signal.aborted) this.#abort();
	}

	run<T>(fn: () => T): T {
		return runRequest(this.store, fn, this.#context);
	}

	#abort = (): void => {
		this.#abortBody?.();
		this.close();
	};

	close(): void {
		if (this.#closed) return;
		this.#closed = true;
		this.store.state.active = false;
		this.#signal.removeEventListener('abort', this.#abort);
		this.store.owner.dispose();
	}

	response(response: Response): Response {
		if (!response.body) {
			this.close();
			return response;
		}
		const reader = response.body.getReader();
		const scope = this;
		const body = new ReadableStream<Uint8Array>(
			{
				start(controller) {
					scope.#abortBody = () => {
						void reader.cancel(scope.#signal.reason).catch(() => {});
						controller.error(scope.#signal.reason);
					};
					if (scope.#signal.aborted) scope.#abortBody();
				},
				async pull(controller) {
					try {
						const next = await scope.run(() => reader.read());
						if (next.done) {
							controller.close();
							scope.close();
						} else controller.enqueue(next.value);
					} catch (error) {
						controller.error(error);
						scope.close();
					}
				},
				async cancel(reason) {
					scope.close();
					await reader.cancel(reason);
				}
			},
			{ highWaterMark: 0 }
		);
		return new Response(body, {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers
		});
	}
}
