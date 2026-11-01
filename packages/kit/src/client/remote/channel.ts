import { untrack } from 'vigla';
import type { RemoteData, RemoteNode, RemoteResponse } from '../../types/internal/remote.ts';
import { HttpError, Redirect } from '../../shared/outcomes.ts';
import type { Client } from '../client.ts';
import { payload } from '../payload.ts';
import { readStream } from '../stream.ts';
import type { QueryFlight } from './query.ts';

function object(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function errorBody(value: unknown): value is App.Error {
	return object(value) && typeof value.status === 'number' && typeof value.message === 'string';
}

function response(value: unknown): RemoteResponse {
	if (object(value)) {
		if (value.type === 'result' && (value.data === null || typeof value.data === 'string'))
			return { type: 'result', data: value.data };
		if (value.type === 'error' && errorBody(value.error))
			return { type: 'error', error: value.error };
		if (value.type === 'redirect' && typeof value.location === 'string')
			return { type: 'redirect', location: value.location };
	}
	throw new TypeError('Invalid remote function response');
}

function nodes(value: unknown): value is Record<string, RemoteNode> {
	return (
		object(value) &&
		Object.values(value).every(
			(node) => object(node) && (node.e === undefined || errorBody(node.e))
		)
	);
}

function data(value: unknown): RemoteData {
	if (
		!object(value) ||
		['q', 'l', 'p', 'f'].some((key) => value[key] !== undefined && !nodes(value[key])) ||
		(value.i !== undefined &&
			(!Array.isArray(value.i) || value.i.some((key) => typeof key !== 'string'))) ||
		(value.r !== undefined && typeof value.r !== 'boolean') ||
		(value.redirect !== undefined && typeof value.redirect !== 'string')
	)
		throw new TypeError('Invalid remote function data');
	return value as RemoteData;
}

export class Channel {
	readonly client: Client;
	readonly #controller = new AbortController();

	constructor(client: Client) {
		this.client = client;
	}

	url(id: string): string {
		return `${payload.base ?? ''}/${payload.app_dir ?? '_app'}/remote/${id}`;
	}

	headers(): Record<string, string> {
		return untrack(() => {
			const url = this.client.state.navigation.current?.to?.url ?? this.client.state.page.url;
			const current = url.protocol === 'a:' ? new URL(location.href) : url;
			return { 'x-sveltekit-pathname': current.pathname, 'x-sveltekit-search': current.search };
		});
	}

	async unwrap(result: RemoteResponse): Promise<string | null> {
		if (result.type === 'error') throw new HttpError(result.error);
		if (result.type === 'redirect') {
			await this.redirect(result.location);
			throw new Redirect(307, result.location);
		}
		return result.data;
	}

	async redirect(location: string, refreshAll = false): Promise<void> {
		const url = this.client.url(location);
		if (this.client.routes.outside(url)) {
			window.location.href = url.href;
			return;
		}
		await this.client.goto(url, { refreshAll });
	}

	abort(): void {
		this.#controller.abort();
	}

	async fetch(url: string, init?: RequestInit): Promise<Response> {
		const signal = init?.signal
			? AbortSignal.any([init.signal, this.#controller.signal])
			: this.#controller.signal;
		const result = await fetch(url, { ...init, signal });
		this.client.state.notify(result.headers.get('x-sveltekit-version'));
		if (!result.ok) {
			const body: unknown = await result.json().catch(() => undefined);
			throw new HttpError(
				object(body) && body.type === 'error' && errorBody(body.error)
					? { ...body.error, status: result.status }
					: { status: result.status, message: result.statusText }
			);
		}
		return result;
	}

	async request(
		url: string,
		init?: RequestInit,
		refreshes?: Set<string>,
		flights?: readonly QueryFlight[]
	): Promise<RemoteData> {
		const result = await this.fetch(url, init);
		const encoded = await this.unwrap(response(await result.json()));
		const decoded = data(encoded ? this.client.transport.parse(encoded) : {});
		this.client.remote.apply(decoded, refreshes, flights);
		return decoded;
	}

	async *stream(
		id: string,
		payload: string,
		signal: AbortSignal,
		connected: () => void
	): AsyncGenerator<any> {
		const url = this.url(id) + (payload ? `?payload=${payload}` : '');
		const result = await this.fetch(url, { headers: { accept: 'text/event-stream' }, signal });
		if (result.headers.get('content-type')?.includes('application/json')) {
			await this.unwrap(response(await result.json()));
			throw new HttpError({ status: 500, message: 'Invalid query.live response' });
		}
		if (!result.body)
			throw new TypeError('Expected query.live response body to be a ReadableStream');
		connected();
		for await (const block of readStream(result.body.getReader(), '\n\n')) {
			const lines = block.split('\n').filter((line) => line.startsWith('data:'));
			const text = lines.map((line) => line.slice(5).trimStart()).join('\n');
			if (!text) continue;
			const node: unknown = JSON.parse(text);
			if (object(node) && node.type === 'result' && typeof node.result === 'string') {
				yield this.client.transport.parse(node.result);
			} else {
				await this.unwrap(response(node));
				throw new HttpError({ status: 500, message: 'Invalid query.live response' });
			}
		}
	}
}
