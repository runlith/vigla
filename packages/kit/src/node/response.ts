import type { ServerResponse } from 'node:http';
import { setImmediate } from 'node:timers';
import { drainRequest } from './request.ts';

export function setResponse(response: ServerResponse, result: Response): void {
	response.once('finish', () => drainRequest(response.req));
	response.once('close', () => drainRequest(response.req));
	try {
		for (const [name, value] of result.headers)
			response.setHeader(name, name === 'set-cookie' ? result.headers.getSetCookie() : value);
	} catch (error) {
		for (const name of response.getHeaderNames()) response.removeHeader(name);
		response.writeHead(500).end(String(error));
		return;
	}
	if (result.body === null) {
		response.writeHead(result.status).end();
		return;
	}
	if (result.body.locked) {
		response
			.writeHead(result.status)
			.end(
				"Fatal error: Response body is locked. This can happen when the response was already read (for example through 'response.json()' or 'response.text()')."
			);
		return;
	}

	const reader = result.body.getReader();
	if (response.destroyed) {
		void reader.cancel().catch(() => {});
		return;
	}
	const queue: Uint8Array[] = [];
	let pending: Promise<ReadableStreamReadResult<Uint8Array>> | undefined;
	let stopped = false;
	let complete = false;

	const cancel = (reason?: Error): void => {
		stopped = true;
		response.off('close', cancel);
		response.off('error', cancel);
		response.off('drain', pump);
		void reader.cancel(reason).catch(() => {});
		if (reason) response.destroy(reason);
	};
	response.on('close', cancel);
	response.on('error', cancel);

	function fail(reason: unknown): void {
		if (!response.headersSent) response.writeHead(result.status);
		cancel(reason instanceof Error ? reason : new Error(String(reason)));
	}

	async function pump(): Promise<void> {
		try {
			while (!stopped && !response.destroyed) {
				const chunk = queue.shift();
				if (chunk !== undefined) {
					if (!response.write(chunk)) {
						response.once('drain', pump);
						return;
					}
					continue;
				}
				if (complete) {
					response.end();
					return;
				}
				const next = await (pending ?? reader.read());
				pending = undefined;
				if (next.done) complete = true;
				else queue.push(next.value);
			}
		} catch (error) {
			fail(error);
		}
	}

	async function probe(): Promise<void> {
		try {
			const deadline = new Promise<undefined>((resolve) => setImmediate(() => resolve(undefined)));
			while (queue.length < 2) {
				pending = reader.read();
				const next = await Promise.race([pending, deadline]);
				if (next === undefined) break;
				pending = undefined;
				if (next.done) {
					complete = true;
					if (!response.hasHeader('content-length') && !response.hasHeader('transfer-encoding')) {
						response.setHeader(
							'content-length',
							queue.reduce((total, chunk) => total + chunk.byteLength, 0)
						);
					}
					break;
				}
				queue.push(next.value);
			}
			if (stopped || response.destroyed) return;
			response.writeHead(result.status);
			await pump();
		} catch (error) {
			fail(error);
		}
	}
	void probe();
}
