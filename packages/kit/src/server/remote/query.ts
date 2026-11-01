import { root } from 'vigla';
import type { Query } from '../../types/remote-functions.ts';
import type {
	RemoteBatchEntry,
	RemoteBatchInternals,
	RemoteImplementation,
	RemoteLiveInternals,
	RemoteQueryInternals
} from '../../types/internal/remote.ts';
import type { RequestStore } from '../../types/internal/server.ts';
import { encodeArgument, getRemoteKey } from '../../shared/remote.ts';
import { getRequestStore } from '../scope.ts';
import { handleError } from '../failure.ts';
import { createValidator, execute, generate } from './shared.ts';
import { resource, liveResource } from './resource.ts';
import { LiveIterator } from './iteration.ts';
import * as errors from './errors.ts';

function assertDynamic(store: RequestStore, type: string, name: string): void {
	if (store.state.prerendering) errors.queryPrerender(type, name);
}

function single(validation: any, implementation?: RemoteImplementation): any {
	const fn = implementation ?? validation;
	const validate = createValidator(validation, implementation);
	const internals: RemoteQueryInternals = {
		type: 'query',
		id: '',
		name: '',
		validate,
		implementation: fn,
		bind(payload, arg) {
			const store = getRequestStore();
			return resource(store, internals, payload, () =>
				execute(store, { query: true }, false, () => arg, fn)
			);
		}
	};
	const invoke = (arg: unknown) => {
		const store = getRequestStore();
		assertDynamic(store, 'query', internals.name);
		const payload = encodeArgument(arg, store.hooks.transport);
		return resource(store, internals, payload, () =>
			execute(store, { query: true }, false, () => validate(arg), fn)
		);
	};
	return Object.defineProperty(invoke, '__', { value: internals });
}

function batch(validation: any, implementation?: RemoteImplementation): any {
	const fn = implementation ?? validation;
	const validate = createValidator(validation, implementation);
	const internals: RemoteBatchInternals = {
		type: 'query_batch',
		id: '',
		name: '',
		validate,
		implementation: fn,
		async run(args) {
			const store = getRequestStore();
			return execute(
				store,
				{ query: true },
				false,
				() => Promise.all(args.map(validate)),
				async (input: any[]) => {
					const select = await fn(input);
					return Promise.all(
						input.map(async (arg, index) => {
							try {
								return { type: 'result' as const, data: await select(arg, index) };
							} catch (error) {
								return { type: 'error' as const, error: await handleError(store, error) };
							}
						})
					);
				}
			);
		},
		bind(payload, arg) {
			const store = getRequestStore();
			return resource(store, internals, payload, () => enqueue(store, payload, () => arg));
		}
	};
	const enqueue = (
		store: RequestStore,
		payload: string,
		input: RemoteBatchEntry['input']
	): Promise<any> => {
		return new Promise((resolve, reject) => {
			let queue = store.remote.batches.get(internals);
			if (!queue) {
				store.remote.batches.set(internals, (queue = new Map()));
				const entries = queue;
				setTimeout(() => {
					store.remote.batches.delete(internals);
					const batch = [...entries.values()];
					void execute(
						store,
						{ query: true },
						false,
						() => Promise.all(batch.map((entry) => entry.input())),
						async (args: any[]) => {
							const select = await fn(args);
							for (const [index, entry] of batch.entries()) {
								try {
									const value = await select(args[index], index);
									for (const resolver of entry.resolvers) resolver.resolve(value);
								} catch (error) {
									for (const resolver of entry.resolvers) resolver.reject(error);
								}
							}
						}
					).catch((error) => {
						for (const entry of batch)
							for (const resolver of entry.resolvers) resolver.reject(error);
					});
				}, 0);
			}
			const existing = queue.get(payload);
			if (existing) existing.resolvers.push({ resolve, reject });
			else queue.set(payload, { input, resolvers: [{ resolve, reject }] });
		});
	};
	const invoke = (arg: unknown) => {
		const store = getRequestStore();
		assertDynamic(store, 'query.batch', internals.name);
		const payload = encodeArgument(arg, store.hooks.transport);
		return resource(store, internals, payload, () => enqueue(store, payload, () => validate(arg)));
	};
	return Object.defineProperty(invoke, '__', { value: internals });
}

function live(validation: any, implementation?: RemoteImplementation): any {
	const fn = implementation ?? validation;
	const validate = createValidator(validation, implementation);
	const bind = (store: RequestStore, payload: string, input: () => any) => {
		const generator = () => generate(store, input, fn, internals.name);
		return liveResource(
			store,
			internals,
			payload,
			async () => {
				for await (const value of generator()) return value;
				return errors.liveEmpty(internals.name);
			},
			() => {
				const key = getRemoteKey(internals.id, payload);
				let stream = store.remote.live.get(key);
				if (!stream) {
					const iterator = new LiveIterator(store.event.request.signal, generator);
					root(() => iterator.close, store.owner);
					store.remote.live.set(key, (stream = iterator));
				}
				return stream.subscribe();
			}
		);
	};
	const internals: RemoteLiveInternals = {
		type: 'query_live',
		id: '',
		name: '',
		validate,
		implementation: fn,
		run: (store, arg) => generate(store, () => validate(arg), fn, internals.name),
		bind: (payload, arg) => bind(getRequestStore(), payload, () => arg)
	};
	const invoke = (arg: unknown) => {
		const store = getRequestStore();
		assertDynamic(store, 'query.live', internals.name);
		return bind(store, encodeArgument(arg, store.hooks.transport), () => validate(arg));
	};
	return Object.defineProperty(invoke, '__', { value: internals });
}

export const query: Query = Object.assign(single, { batch, live });
