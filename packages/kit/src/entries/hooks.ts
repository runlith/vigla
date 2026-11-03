import type { Handle, ResolveOptions } from '../types/hooks.ts';
import type { RequestEvent } from '../types/request.ts';
import { findRequest, runRequest } from '../server/scope.ts';

export type {
	CaughtError,
	ClientCaughtError,
	ClientInit,
	Handle,
	HandleClientError,
	HandleFetch,
	HandleServerError,
	Reroute,
	ResolveOptions,
	ServerInit,
	Transport,
	Transporter
} from '../types/hooks.ts';

export function sequence(...handlers: Handle[]): Handle {
	if (!handlers.length) return ({ event, resolve }) => resolve(event);
	return ({ event, resolve }) => {
		const store = findRequest();
		const next = (
			index: number,
			event: RequestEvent,
			options?: ResolveOptions
		): Promise<Response> => {
			const handler = handlers[index]!;
			const call = async (event: RequestEvent): Promise<Response> =>
				handler({
					event,
					resolve(event, current) {
						const combined: ResolveOptions = {
							preload: options?.preload ?? current?.preload,
							filterSerializedResponseHeaders:
								options?.filterSerializedResponseHeaders ??
								current?.filterSerializedResponseHeaders,
							async transformPageChunk(chunk) {
								let html = chunk.html;
								if (current?.transformPageChunk)
									html = (await current.transformPageChunk({ ...chunk, html })) ?? '';
								if (options?.transformPageChunk)
									html = (await options.transformPageChunk({ ...chunk, html })) ?? '';
								return html;
							}
						};
						return index < handlers.length - 1
							? next(index + 1, event, combined)
							: resolve(event, combined);
					}
				});
			if (!store) return call(event);
			return store.tracer.span(
				`sveltekit.handle.sequenced.${handler.name || index}`,
				{},
				async (span) => {
					const traced = { ...event, tracing: { ...event.tracing, current: span } };
					return runRequest({ ...store, event: traced }, () => call(traced));
				}
			);
		};
		return next(0, event);
	};
}
