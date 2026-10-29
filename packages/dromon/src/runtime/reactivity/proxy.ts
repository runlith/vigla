import { write } from './batch.ts';
import type { Source } from './graph.ts';
import { state } from './sources.ts';
import { get } from './tracking.ts';

const RAW = Symbol('raw');

const ABSENT = Symbol('absent');

type Indexed = Record<PropertyKey, unknown>;

function proxiable(value: unknown): value is Indexed {
	if (typeof value !== 'object' || value === null || RAW in value) return false;
	const prototype = Object.getPrototypeOf(value) as unknown;
	return prototype === Object.prototype || prototype === Array.prototype || prototype === null;
}

function index(prop: string | symbol): number {
	return typeof prop === 'string' && /^(0|[1-9]\d*)$/.test(prop) ? Number(prop) : -1;
}

function clone(value: unknown, cloned: Map<object, unknown>): unknown {
	if (typeof value === 'object' && value !== null) {
		const known = cloned.get(value);
		if (known !== undefined) return known;
		if (value instanceof Map) return new Map(value);
		if (value instanceof Set) return new Set(value);
		if (Array.isArray(value)) {
			const copy: unknown[] = new Array(value.length);
			cloned.set(value, copy);
			for (let position = 0; position < value.length; position++) {
				if (position in value) copy[position] = clone(value[position], cloned);
			}
			return copy;
		}
		if (Object.getPrototypeOf(value) === Object.prototype) {
			const copy: Indexed = {};
			cloned.set(value, copy);
			for (const key of Object.keys(value)) copy[key] = clone((value as Indexed)[key], cloned);
			return copy;
		}
		if (value instanceof Date) return structuredClone(value);
		const json = (value as { toJSON?: unknown }).toJSON;
		if (typeof json === 'function') {
			const copy = clone(json.call(value), cloned);
			cloned.set(value, copy);
			return copy;
		}
	}
	if (typeof EventTarget === 'function' && value instanceof EventTarget) return value;
	try {
		return structuredClone(value);
	} catch {
		return value;
	}
}

export function snapshot<T>(value: T): T {
	return clone(value, new Map()) as T;
}

export function proxy<T>(value: T): T {
	if (!proxiable(value)) return value;
	const target = value;
	const array = Array.isArray(target);
	const sources = new Map<string | symbol, Source<unknown>>();
	const keys = state(0);
	if (array) sources.set('length', state((target as unknown as unknown[]).length));

	const source = (prop: string | symbol): Source<unknown> => {
		let found = sources.get(prop);
		if (found === undefined) {
			found = state(Object.hasOwn(target, prop) ? proxy(target[prop]) : ABSENT);
			sources.set(prop, found);
		}
		return found;
	};

	const tracked = (prop: string | symbol): boolean => {
		if (typeof prop === 'symbol') return false;
		if (sources.has(prop) || !(prop in target)) return true;
		const descriptor = Object.getOwnPropertyDescriptor(target, prop);
		return descriptor !== undefined && 'value' in descriptor && descriptor.writable === true;
	};

	const assign = (prop: string | symbol, next: unknown): void => {
		const existing = sources.get(prop);
		const added = existing === undefined ? !Object.hasOwn(target, prop) : existing.v === ABSENT;
		write(source(prop), proxy(next));
		if (array) {
			const position = index(prop);
			const length = sources.get('length') as Source<unknown>;
			if (position >= (length.v as number)) write(length, position + 1);
		}
		if (added) write(keys, (keys.v as number) + 1);
	};

	return new Proxy(target, {
		get(object, prop, receiver) {
			if (prop === RAW) return object;
			if (!tracked(prop)) return Reflect.get(object, prop, receiver);
			const found = get(source(prop));
			if (found !== ABSENT) return found;
			return Object.hasOwn(object, prop) ? undefined : Reflect.get(object, prop, receiver);
		},
		has(object, prop) {
			if (prop === RAW) return true;
			if (!tracked(prop)) return Reflect.has(object, prop);
			const found = get(source(prop));
			return found === ABSENT ? Reflect.has(object, prop) && !Object.hasOwn(object, prop) : true;
		},
		set(object, prop, next, receiver) {
			if (!tracked(prop)) return Reflect.set(object, prop, next, receiver);
			if (array && prop === 'length') {
				const length = sources.get('length') as Source<unknown>;
				for (let position = next as number; position < (length.v as number); position++) {
					const key = String(position);
					const item = sources.get(key);
					if (item === undefined) sources.set(key, state(ABSENT));
					else write(item, ABSENT);
				}
				write(length, next);
				write(keys, (keys.v as number) + 1);
				return true;
			}
			assign(prop, next);
			return true;
		},
		deleteProperty(object, prop) {
			if (!tracked(prop)) return Reflect.deleteProperty(object, prop);
			const found = source(prop);
			if (found.v !== ABSENT) {
				write(found, ABSENT);
				write(keys, (keys.v as number) + 1);
			}
			return true;
		},
		ownKeys(object) {
			get(keys);
			const own = Reflect.ownKeys(object).filter((key) => {
				const found = sources.get(key);
				return found === undefined || found.v !== ABSENT;
			});
			for (const [key, found] of sources) {
				if (found.v !== ABSENT && !own.includes(key)) own.push(key);
			}
			return own;
		},
		getOwnPropertyDescriptor(object, prop) {
			const descriptor = Reflect.getOwnPropertyDescriptor(object, prop);
			if (!tracked(prop)) return descriptor;
			const found = get(source(prop));
			if (found === ABSENT) return undefined;
			if (descriptor !== undefined) return { ...descriptor, value: found };
			return { value: found, writable: true, enumerable: true, configurable: true };
		},
		defineProperty(object, prop, descriptor) {
			if (!tracked(prop) || !('value' in descriptor))
				return Reflect.defineProperty(object, prop, descriptor);
			assign(prop, descriptor.value);
			return true;
		}
	});
}
