import type { RemoteData, RemoteInternals, RemoteNode } from '../../types/internal/remote.ts';
import type { RequestStore } from '../../types/internal/server.ts';
import { Redirect } from '../../shared/outcomes.ts';
import { handleError } from '../failure.ts';

function bucket(data: RemoteData, internals: RemoteInternals): Record<string, RemoteNode> {
	if (internals.type === 'query_live') return (data.l ??= {});
	if (internals.type === 'prerender') return (data.p ??= {});
	if (internals.type === 'form') return (data.f ??= {});
	return (data.q ??= {});
}

export async function collect(store: RequestStore, data: RemoteData): Promise<RemoteData> {
	const processed = new Set<string>();
	const inflight: Promise<void>[] = [];
	const drain = (): void => {
		for (const [key, entry] of store.remote.explicit) {
			store.remote.explicit.delete(key);
			if (processed.has(key)) continue;
			processed.add(key);
			data.r = true;
			inflight.push(
				entry.read().then(
					(v) => {
						bucket(data, entry.internals)[key] = { v };
						drain();
					},
					async (error) => {
						if (!(error instanceof Redirect))
							bucket(data, entry.internals)[key] = { e: await handleError(store, error) };
						drain();
					}
				)
			);
		}
	};
	drain();
	for (let index = 0; index < inflight.length; index++) await inflight[index];
	const errors: Promise<void>[] = [];
	for (const [key, entry] of store.remote.implicit) {
		if (!entry.internals.id || processed.has(key)) continue;
		let ready = true;
		await Promise.race([
			entry.read().then(
				(v) => {
					if (ready) bucket(data, entry.internals)[key] = { v };
				},
				async (error) => {
					if (ready && !(error instanceof Redirect))
						errors.push(
							handleError(store, error).then((e) => {
								bucket(data, entry.internals)[key] = { e };
							})
						);
				}
			),
			Promise.resolve().then(() => {
				ready = false;
			})
		]);
	}
	await Promise.all(errors);
	if (store.remote.ignored.size) data.i = [...store.remote.ignored];
	return data;
}
