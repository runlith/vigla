import type { Handle, ResolveOptions } from '../types/hooks.ts';
import type { RequestEvent } from '../types/request.ts';

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
	return ({ event, resolve }) => {
		const next = async (
			index: number,
			event: RequestEvent,
			options?: ResolveOptions
		): Promise<Response> => {
			const handler = handlers[index];
			if (handler === undefined) return resolve(event, options);
			return handler({
				event,
				resolve(event, current) {
					const combined: ResolveOptions = {
						preload: options?.preload ?? current?.preload,
						filterSerializedResponseHeaders:
							options?.filterSerializedResponseHeaders ?? current?.filterSerializedResponseHeaders,
						async transformPageChunk(chunk) {
							let html = chunk.html;
							if (current?.transformPageChunk)
								html = (await current.transformPageChunk({ ...chunk, html })) ?? '';
							if (options?.transformPageChunk)
								html = (await options.transformPageChunk({ ...chunk, html })) ?? '';
							return html;
						}
					};
					return next(index + 1, event, combined);
				}
			});
		};
		return next(0, event);
	};
}
