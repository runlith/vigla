import { hydrated } from 'vigla';
import type {
	RemoteInternals,
	RemoteNode,
	RemoteReadInternals
} from '../../types/internal/remote.ts';
import type { RemoteLiveQuery, RemoteQuery } from '../../types/remote.ts';
import type { RequestStore } from '../../types/internal/server.ts';
import { getRemoteKey } from '../../shared/remote.ts';
import { serialize } from '../../shared/serialization.ts';
import { Redirect } from '../../shared/outcomes.ts';
import { handleError } from '../failure.ts';
import { server_api_unavailable } from '../errors.ts';
import { thenable } from './shared.ts';

export function cache(store: RequestStore, internals: RemoteInternals): Map<string, Promise<any>> {
	let values = store.remote.cache.get(internals);
	if (!values) store.remote.cache.set(internals, (values = new Map()));
	return values;
}

export function snapshot(
	store: RequestStore,
	key: string,
	read: () => RemoteNode | Promise<RemoteNode>
): void {
	if (store.event.isRemoteRequest || store.remote.hydration.has(key)) return;
	store.remote.snapshots.set(key, { read });
}

export function publishSnapshots(store: RequestStore): void {
	for (const [key, snapshot] of store.remote.snapshots) {
		if (store.remote.hydration.has(key)) continue;
		store.owner.run(() =>
			hydrated(key, () => {
				const node = snapshot.read();
				return thenable(node)
					? Promise.resolve(node).then((value) => serialize(value, store.hooks.transport))
					: serialize(node, store.hooks.transport);
			})
		);
		store.remote.hydration.add(key);
	}
}

export function refresh(
	store: RequestStore,
	internals: RemoteInternals,
	payload: string,
	read: () => Promise<any>
): void {
	if (!internals.id || (!store.event.isRemoteRequest && store.remote.mutation)) return;
	store.remote.explicit.set(getRemoteKey(internals.id, payload), { internals, read });
}

export function resource(
	store: RequestStore,
	internals: RemoteInternals,
	payload: string,
	execute: () => Promise<any>
): RemoteQuery<any> {
	let pending: Promise<any> | null = null;
	const read = (): Promise<any> =>
		(pending ??= Promise.resolve().then(() => {
			const values = cache(store, internals);
			let result = values.get(payload);
			if (!result) values.set(payload, (result = execute()));
			if (internals.id && !store.remote.query) {
				const key = getRemoteKey(internals.id, payload);
				store.remote.implicit.set(key, { internals, read });
				if (!store.event.isRemoteRequest)
					void result
						.then(
							(v) => {
								if (store.state.active && values.get(payload) === result)
									snapshot(store, key, () => ({ v }));
							},
							(error) => {
								if (
									error instanceof Redirect ||
									!store.state.active ||
									values.get(payload) !== result
								)
									return;
								snapshot(store, key, () => handleError(store, error).then((e) => ({ e })));
							}
						)
						.catch(() => {});
			}
			return result;
		}));
	const prime = (): void => {
		if (store.state.isRendering) void read().catch(() => {});
	};
	const value = {
		then: (resolve: any, reject: any) => read().then(resolve, reject),
		catch: (reject: any) => read().catch(reject),
		finally: (finish: any) => read().finally(finish),
		get current() {
			prime();
			return undefined;
		},
		get error() {
			prime();
			return undefined;
		},
		get loading() {
			prime();
			return true;
		},
		get ready() {
			prime();
			return false;
		},
		refresh() {
			pending = null;
			cache(store, internals).delete(payload);
			store.remote.snapshots.delete(getRemoteKey(internals.id, payload));
			refresh(store, internals, payload, read);
			return Promise.resolve();
		},
		set(value: any) {
			const result = (pending = Promise.resolve(value));
			cache(store, internals).set(payload, result);
			if (internals.id) snapshot(store, getRemoteKey(internals.id, payload), () => ({ v: value }));
			refresh(store, internals, payload, () => result);
		},
		withOverride: () => server_api_unavailable({ name: `${internals.name}.withOverride()` }),
		[Symbol.toStringTag]: 'QueryResource'
	};
	return value as unknown as RemoteQuery<any>;
}

export function liveResource(
	store: RequestStore,
	internals: RemoteReadInternals,
	payload: string,
	first: () => Promise<any>,
	iterate: () => AsyncIterableIterator<any>
): RemoteLiveQuery<any> {
	const value = resource(store, internals, payload, first);
	return Object.defineProperties(value, {
		connected: { get: () => false },
		done: { get: () => false },
		reconnect: { value: value.refresh },
		[Symbol.asyncIterator]: { value: iterate }
	}) as unknown as RemoteLiveQuery<any>;
}
