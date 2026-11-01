import { root } from 'vigla';
import type { RemoteLiveInternals, RemoteLiveResponse } from '../../types/internal/remote.ts';
import type { RequestStore } from '../../types/internal/server.ts';
import { Redirect } from '../../shared/outcomes.ts';
import { serialize } from '../../shared/serialization.ts';
import { handleError } from '../failure.ts';

export function liveResponse(
	store: RequestStore,
	internals: RemoteLiveInternals,
	arg: unknown
): Response {
	const cancellation = new AbortController();
	const signal = AbortSignal.any([store.event.request.signal, cancellation.signal]);
	const event = { ...store.event, request: new Request(store.event.request, { signal }) };
	const generator = internals.run({ ...store, event }, arg);
	const encoder = new TextEncoder();
	let controller: ReadableStreamDefaultController<Uint8Array>;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let open = true;
	let previous: string | undefined;
	const close = (cancelled: boolean): void => {
		if (!open) return;
		open = false;
		clearTimeout(timer);
		store.event.request.signal.removeEventListener('abort', abort);
		cancellation.abort();
		if (!cancelled) controller.close();
		void generator.return(undefined).catch(() => {});
	};
	const abort = () => close(true);
	const keepAlive = (): void => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			if (!open) return;
			if ((controller.desiredSize ?? 0) > 0) controller.enqueue(encoder.encode(': keep-alive\n\n'));
			keepAlive();
		}, 30_000);
	};
	const send = (value: RemoteLiveResponse): void => {
		if (!open) return;
		controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
		keepAlive();
	};
	store.event.request.signal.addEventListener('abort', abort, { once: true });
	root(() => () => close(true), store.owner);
	const body = new ReadableStream<Uint8Array>({
		start(output) {
			controller = output;
			keepAlive();
		},
		async pull() {
			try {
				while (open) {
					const next = await generator.next();
					if (!open) return;
					if (next.done) {
						close(false);
						return;
					}
					const result = serialize(next.value, store.hooks.transport);
					if (result === previous) continue;
					previous = result;
					send({ type: 'result', result });
					return;
				}
			} catch (error) {
				if (!open) return;
				if (error instanceof Redirect) send({ type: 'redirect', location: error.location });
				else send({ type: 'error', error: await handleError(store, error) });
				close(false);
			}
		},
		cancel() {
			close(true);
		}
	});
	return new Response(body, {
		headers: { 'cache-control': 'private, no-store', 'content-type': 'text/event-stream' }
	});
}
