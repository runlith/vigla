import { parse, stringify, stringifyAsync } from 'devalue';
import type { Transport } from '../types/hooks.ts';
import { decoders, encoders, type Decoders, type Encoders } from './serialization.ts';
import * as errors from './errors.ts';

const objectType = '__skrao';
const mapType = '__skram';
const setType = '__skras';
const fileType = '__skraf';
const prototypeKeys = Object.getOwnPropertyNames(Object.prototype).sort().join('\0');

function isPlain(value: unknown): value is Record<string, unknown> {
	if (!value || typeof value !== 'object') return false;
	const prototype = Object.getPrototypeOf(value);
	return (
		prototype === null ||
		prototype === Object.prototype ||
		Object.getPrototypeOf(prototype) === null ||
		Object.getOwnPropertyNames(prototype).sort().join('\0') === prototypeKeys
	);
}

function reducers(transport: Transport, canonical: boolean): Encoders {
	const codecs: Encoders = {
		...encoders(transport),
		__skrag(value) {
			if (value instanceof RegExp)
				errors.remote_argument_unsupported({ type: 'Regular expressions' });
		}
	};
	if (canonical) {
		const originals = new Map<object, Record<string, unknown>>();
		const sorted = new Set<object>();
		const encode = (value: unknown) => stringify(value, codecs);
		codecs[mapType] = (value: unknown) =>
			value instanceof Map
				? [...value]
						.map(([key, item]): [string, string] => [encode(key), encode(item)])
						.sort(([a, b], [c, d]) => (a < c ? -1 : a > c ? 1 : b < d ? -1 : b > d ? 1 : 0))
				: undefined;
		codecs[setType] = (value: unknown) =>
			value instanceof Set ? [...value].map(encode).sort() : undefined;
		codecs[objectType] = (value: unknown) => {
			if (!isPlain(value) || sorted.has(value)) return;
			const previous = originals.get(value);
			if (previous) return previous;
			const clone = Object.create(Object.getPrototypeOf(value) === null ? null : Object.prototype);
			originals.set(value, clone);
			sorted.add(clone);
			for (const key of Object.keys(value).sort()) {
				const item = value[key];
				Object.defineProperty(clone, key, {
					value: originals.get(item as object) ?? item,
					enumerable: true,
					configurable: true,
					writable: true
				});
			}
			return clone;
		};
	}
	return codecs;
}

function revivers(transport: Transport): Decoders {
	const codecs: Decoders = {
		...decoders(transport),
		[objectType]: (value) => value,
		[mapType](value: unknown) {
			if (
				!Array.isArray(value) ||
				value.some(
					(entry) =>
						!Array.isArray(entry) ||
						entry.length !== 2 ||
						entry.some((item) => typeof item !== 'string')
				)
			) {
				throw new Error('Invalid data for Map reviver');
			}
			return new Map(value.map(([key, item]) => [parse(key, codecs), parse(item, codecs)]));
		},
		[setType](value: unknown) {
			if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
				throw new Error('Invalid data for Set reviver');
			}
			return new Set(value.map((item) => parse(item, codecs)));
		},
		[fileType](value: any) {
			if (
				!value ||
				typeof value.name !== 'string' ||
				typeof value.type !== 'string' ||
				typeof value.size !== 'number' ||
				typeof value.lastModified !== 'number' ||
				!(value.data instanceof ArrayBuffer)
			)
				throw new Error('Invalid data for File reviver');
			return new File([value.data], value.name, {
				type: value.type,
				lastModified: value.lastModified
			});
		}
	};
	return codecs;
}

function base64url(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');
}

export function encodeArgument(value: unknown, transport: Transport = {}): string {
	return value === undefined ? '' : base64url(stringify(value, reducers(transport, true)));
}

export async function encodeCommand(value: unknown, transport: Transport = {}): Promise<string> {
	if (value === undefined) return '';
	const codecs = reducers(transport, false);
	const files = new Set<Promise<unknown>>();
	codecs[fileType] = (value: unknown) => {
		if (!(value instanceof File)) return;
		const pending = value.arrayBuffer().then((data) => ({
			data,
			lastModified: value.lastModified,
			name: value.name,
			size: value.size,
			type: value.type
		}));
		files.add(pending);
		return pending;
	};
	codecs.__skrap = (value: unknown) => {
		if (value instanceof Promise && !files.has(value))
			errors.remote_argument_unsupported({ type: 'Promises' });
	};
	return base64url(await stringifyAsync(value, codecs));
}

export function decodeArgument(payload: string | null, transport: Transport = {}): any {
	if (!payload) return undefined;
	const binary = atob(payload.replaceAll('-', '+').replaceAll('_', '/'));
	const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
	return parse(new TextDecoder().decode(bytes), revivers(transport));
}

export function getRemoteKey(id: string, payload: string): string {
	return `${id}/${payload}`;
}

export interface RemoteKey {
	id: string;
	payload: string;
}

export function splitRemoteKey(key: string): RemoteKey {
	const slash = key.lastIndexOf('/');
	if (slash === -1) throw new Error(`Invalid remote key: ${key}`);
	return { id: key.slice(0, slash), payload: key.slice(slash + 1) };
}
