import type { Requested } from '../../types/remote-functions.ts';
import type { RemoteExport, RemoteReadInternals } from '../../types/internal/remote.ts';
import type { RemoteLiveQuery, RemoteQuery } from '../../types/remote.ts';
import { decodeArgument, getRemoteKey } from '../../shared/remote.ts';
import { getRequestStore, runRequest } from '../scope.ts';
import { cache, refresh } from './resource.ts';
import { thenable } from './shared.ts';
import * as errors from './errors.ts';

interface RequestedEntry {
	arg: any;
	query: RemoteQuery<any> | RemoteLiveQuery<any>;
	ignore(): void;
}

export const requested: Requested = (query: unknown, limit: number): any => {
	const store = getRequestStore();
	const internals = (query as RemoteExport | undefined)?.__;
	if (!internals || !['query', 'query_batch', 'query_live'].includes(internals.type))
		errors.requestedQuery();
	const read = internals as RemoteReadInternals;
	if (!store.remote.mutation) errors.requestedContext();
	if (limit !== Infinity && (!Number.isInteger(limit) || limit < 0)) errors.requestedLimit();
	const payloads = store.remote.requested.get(read.id) ?? new Set<string>();
	const values = [...payloads];
	const selected = values.slice(0, limit);
	const consume = (payload: string): void => {
		payloads.delete(payload);
		if (!payloads.size) store.remote.requested.delete(read.id);
	};
	for (const payload of values.slice(limit)) consume(payload);
	const entry = (payload: string, arg: any): RequestedEntry => ({
		arg,
		query: runRequest(store, () => read.bind(payload, arg)),
		ignore: () => {
			store.remote.ignored.add(getRemoteKey(read.id, payload));
		}
	});
	const validate = (payload: string) =>
		runRequest(store, () => read.validate(decodeArgument(payload, store.hooks.transport)));
	const fail = (payload: string, error: unknown): void => {
		const pending = Promise.reject(error);
		void pending.catch(() => {});
		cache(store, read).set(payload, pending);
		refresh(store, read, payload, () => pending);
	};
	const result = {
		*[Symbol.iterator](): Generator<RequestedEntry> {
			for (const payload of selected) {
				consume(payload);
				try {
					const arg = validate(payload);
					if (thenable(arg)) errors.requestedAsync(read.name, limit);
					yield entry(payload, arg);
				} catch (error) {
					fail(payload, error);
				}
			}
		},
		async *[Symbol.asyncIterator](): AsyncGenerator<RequestedEntry> {
			const pending = new Set<Promise<{ task: Promise<any>; value?: RequestedEntry }>>();
			for (const payload of selected) {
				consume(payload);
				const task: Promise<{ task: Promise<any>; value?: RequestedEntry }> =
					Promise.resolve().then(async () => {
						try {
							return { task, value: entry(payload, await validate(payload)) };
						} catch (error) {
							fail(payload, error);
							return { task };
						}
					});
				pending.add(task);
			}
			while (pending.size) {
				const { task, value } = await Promise.race(pending);
				pending.delete(task);
				if (value) yield value;
			}
		},
		async refreshAll() {
			if (read.type === 'query_live') errors.requestedMethod('refreshAll', true);
			for await (const { query } of result) void (query as RemoteQuery<any>).refresh();
		},
		async reconnectAll() {
			if (read.type !== 'query_live') errors.requestedMethod('reconnectAll', false);
			for await (const { query } of result) void (query as RemoteLiveQuery<any>).reconnect();
		},
		async ignoreAll() {
			for await (const { ignore } of result) ignore();
		}
	};
	return result;
};
