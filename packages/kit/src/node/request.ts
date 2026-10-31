import type { IncomingMessage } from 'node:http';
import type { RequestInput } from '../types/node.ts';

const listeners = new WeakMap<IncomingMessage, (chunk: Uint8Array) => void>();

class BodyLimitError extends Error {
	readonly status = 413;
	readonly text = 'Payload Too Large';
}

function body(request: IncomingMessage, limit?: number): ReadableStream<Uint8Array> | null {
	const length = Number(request.headers['content-length']);
	const knownLength = Number.isFinite(length);
	if (
		length === 0 ||
		(request.httpVersionMajor === 1 && !knownLength && request.headers['transfer-encoding'] == null)
	)
		return null;
	if (request.destroyed) return new ReadableStream({ start: (controller) => controller.close() });

	let received = 0;
	let ended = false;
	return new ReadableStream<Uint8Array>({
		start(controller) {
			if (limit !== undefined && knownLength && length > limit) {
				ended = true;
				controller.error(
					new BodyLimitError(`Content-length of ${length} exceeds limit of ${limit} bytes.`)
				);
				return;
			}
			const receive = (chunk: Uint8Array): void => {
				if (ended) return;
				received += chunk.byteLength;
				const reason =
					limit !== undefined && received > limit
						? `request body size exceeded BODY_SIZE_LIMIT of ${limit}`
						: knownLength && received > length
							? `request body size exceeded content-length of ${length}`
							: undefined;
				if (reason !== undefined) {
					ended = true;
					controller.error(new BodyLimitError(reason));
					return;
				}
				controller.enqueue(chunk);
				if ((controller.desiredSize ?? 0) <= 0) request.pause();
			};
			listeners.set(request, receive);
			request.on('data', receive);
			request.on('end', () => {
				if (!ended) {
					ended = true;
					controller.close();
				}
			});
			request.on('error', (error: Error) => {
				ended = true;
				controller.error(error);
			});
		},
		pull() {
			request.resume();
		},
		cancel(reason) {
			ended = true;
			request.destroy(reason);
		}
	});
}

export function drainRequest(request: IncomingMessage | undefined): void {
	if (request === undefined || request.readableEnded || request.destroyed) return;
	const listener = listeners.get(request);
	if (listener !== undefined) {
		request.off('data', listener);
		listeners.delete(request);
	}
	request.resume();
}

interface StreamingRequestInit extends RequestInit {
	duplex: 'half';
}

export function getRequest({ request, response, base, bodySizeLimit }: RequestInput): Request {
	const headers = new Headers();
	for (const [name, value] of Object.entries(request.headers)) {
		if (value === undefined || (request.httpVersionMajor >= 2 && name.startsWith(':'))) continue;
		if (Array.isArray(value)) for (const entry of value) headers.append(name, entry);
		else headers.set(name, value);
	}
	if (request.httpVersionMajor >= 2 && request.headers[':authority'])
		headers.set('host', String(request.headers[':authority']));

	const signal = new AbortController();
	request.once('close', () => {
		if (request.readableAborted) signal.abort();
	});
	response?.once('close', () => {
		if (!response.writableEnded) signal.abort();
	});
	const init: StreamingRequestInit = {
		duplex: 'half',
		method: request.method,
		headers,
		signal: signal.signal,
		body:
			request.method === 'GET' || request.method === 'HEAD'
				? undefined
				: body(request, bodySizeLimit)
	};
	return new Request(base + request.url, init);
}
