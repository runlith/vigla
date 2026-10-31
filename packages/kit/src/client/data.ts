import type {
	DataResponse,
	DataRedirectNode,
	DataChunkNode,
	EncodedDataResponse
} from '../types/internal/data.ts';
import { addDataSuffix } from '../shared/pathname.ts';
import { HttpError } from '../shared/outcomes.ts';
import { readNdjson } from './stream.ts';
import { reserved_query_parameter } from './errors.ts';
import type { State } from './state.ts';
import type { Transport } from './transport.ts';

interface Deferred {
	resolve(value: unknown): void;
	reject(error: unknown): void;
}

function message(value: unknown): EncodedDataResponse | DataRedirectNode | DataChunkNode {
	if (!value || typeof value !== 'object' || !('type' in value))
		throw new TypeError('Invalid data response');
	if (value.type === 'data' && 'nodes' in value && Array.isArray(value.nodes)) {
		for (const node of value.nodes) {
			if (node === null) continue;
			if (!node || typeof node !== 'object') throw new TypeError('Invalid data node');
			if (node.type === 'skip') continue;
			if (node.type === 'error' && node.error && typeof node.error.message === 'string') continue;
			if (node.type !== 'data' || !node.uses || typeof node.uses !== 'object')
				throw new TypeError('Invalid data node');
			for (const key of ['dependencies', 'params', 'search_params']) {
				if (
					node.uses[key] !== undefined &&
					(!Array.isArray(node.uses[key]) ||
						node.uses[key].some((entry: unknown) => typeof entry !== 'string'))
				)
					throw new TypeError('Invalid data dependencies');
			}
		}
		return value as EncodedDataResponse;
	}
	if (
		value.type === 'redirect' &&
		'location' in value &&
		typeof value.location === 'string' &&
		'status' in value &&
		typeof value.status === 'number'
	)
		return value as DataRedirectNode;
	if (
		value.type === 'chunk' &&
		'id' in value &&
		typeof value.id === 'number' &&
		Number.isSafeInteger(value.id) &&
		value.id >= 0
	)
		return value as DataChunkNode;
	throw new TypeError('Invalid data response');
}

export function readData(
	response: Response,
	transport: Transport
): Promise<DataResponse | DataRedirectNode> {
	const first = Promise.withResolvers<DataResponse | DataRedirectNode>();
	const pending = new Map<number, Deferred>();
	let received = false;
	function revive(value: any): any {
		return transport.unflatten(value, {
			Promise: (id: number) => {
				const deferred = Promise.withResolvers<unknown>();
				pending.set(id, deferred);
				void deferred.promise.catch(() => {});
				return deferred.promise;
			}
		});
	}
	void (async () => {
		try {
			if (!response.body) throw new TypeError('Empty data response');
			for await (const value of readNdjson(response.body.getReader())) {
				const frame = message(value);
				if (frame.type === 'redirect') {
					received = true;
					first.resolve(frame);
					return;
				}
				if (frame.type === 'data') {
					if (received) throw new TypeError('Duplicate data response');
					const result: DataResponse = {
						type: 'data',
						nodes: frame.nodes.map((node) =>
							node?.type === 'data' ? { ...node, data: revive(node.data) } : node
						)
					};
					received = true;
					first.resolve(result);
				} else {
					const deferred = pending.get(frame.id);
					if (!deferred) throw new TypeError('Unknown deferred data id');
					pending.delete(frame.id);
					if ('error' in frame) deferred.reject(revive(frame.error));
					else deferred.resolve(revive(frame.data));
				}
			}
			if (!received || pending.size) throw new TypeError('Incomplete data response');
		} catch (error) {
			first.reject(error);
			for (const deferred of pending.values()) deferred.reject(error);
			pending.clear();
		}
	})();
	return first.promise;
}

export async function fetchData(
	url: URL,
	invalid: boolean[],
	transport: Transport,
	state: State
): Promise<DataResponse | DataRedirectNode> {
	for (const key of url.searchParams.keys())
		if (key.startsWith('x-sveltekit-')) reserved_query_parameter({ key });
	const dataUrl = new URL(url);
	dataUrl.pathname = addDataSuffix(url.pathname);
	if (url.pathname.endsWith('/')) dataUrl.searchParams.set('x-sveltekit-trailing-slash', '1');
	dataUrl.searchParams.set(
		'x-sveltekit-invalidated',
		invalid.map((value) => Number(value)).join('')
	);
	const response = await fetch(dataUrl);
	state.notify(response.headers.get('x-sveltekit-version'));
	if (!response.ok) {
		let body: App.Error = {
			status: response.status,
			message: response.status === 404 ? 'Not Found' : 'Internal Error'
		};
		if (response.headers.get('content-type')?.includes('application/json'))
			body = { ...body, ...(await response.json()) };
		throw new HttpError(body);
	}
	return readData(response, transport);
}
