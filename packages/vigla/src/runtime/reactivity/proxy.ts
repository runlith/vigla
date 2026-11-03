import { DEV } from 'esm-env';
import { write } from './scheduler.ts';
import { sequence } from './history.ts';
import { holdEager } from './eager.ts';
import type { Source } from './graph.ts';
import { set, source as plain, state, type Cell } from './sources.ts';
import { get } from './reads.ts';
import { guard, local, untrack } from './tracking.ts';
import { labelFor, labelled, tag } from './provenance.ts';
import { descriptorsFixed } from './errors.ts';

const RAW = Symbol('raw');

const mutating = new Set([
	'copyWithin',
	'fill',
	'pop',
	'push',
	'reverse',
	'shift',
	'sort',
	'splice',
	'unshift'
]);

export const ABSENT = Symbol('absent');

type Indexed = Record<PropertyKey, unknown>;

function proxiable(value: unknown): value is Indexed {
	if (typeof value !== 'object' || value === null || RAW in value) return false;
	const prototype = Object.getPrototypeOf(value) as unknown;
	return prototype === Object.prototype || prototype === Array.prototype || prototype === null;
}

function index(prop: string | symbol): number {
	return typeof prop === 'string' && /^(0|[1-9]\d*)$/.test(prop) ? Number(prop) : -1;
}

export function proxy<T>(value: T): T {
	return wrap(value, true);
}

export function deep<T>(value: T): Cell<T> {
	const held = state(proxy(value));
	return {
		get current() {
			return get(held);
		},
		set current(next) {
			set(held, proxy(next));
		}
	};
}

export function original<T>(value: T): T {
	if (typeof value !== 'object' || value === null) return value;
	return ((value as Indexed)[RAW] as T | undefined) ?? value;
}

function wrap<T>(value: T, aware: boolean): T {
	if (!proxiable(value)) return value;
	const target = value;
	const array = Array.isArray(target);
	const sources = new Map<string | symbol, Source<unknown>>();
	const keys = aware ? state(0) : plain(0);
	if (array) {
		const length = (target as unknown as unknown[]).length;
		sources.set('length', aware ? state(length) : plain(length));
	}

	let path = '';
	let relabelling = false;
	const make = (initial: unknown): Source<unknown> =>
		local(keys) ? state(initial) : plain(initial);
	const nested = <V>(child: V): V => wrap(child, local(keys));

	const source = (prop: string | symbol): Source<unknown> => {
		let found = sources.get(prop);
		if (found === undefined) {
			found = make(Object.hasOwn(target, prop) ? nested(target[prop]) : ABSENT);
			sources.set(prop, found);
			if (DEV) tag(found, labelFor(path, prop));
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
		const found = source(prop);
		guard(found);
		const value = nested(next);
		const origin = sequence();
		write(found, value, origin);
		if (array) {
			const position = index(prop);
			const length = sources.get('length') as Source<unknown>;
			if (position >= (length.v as number)) write(length, position + 1, origin);
		}
		if (added) write(keys, (keys.v as number) + 1, origin);
	};

	const wrapped = new Proxy(target, {
		get(object, prop, receiver) {
			if (prop === RAW) return object;
			if (!tracked(prop)) {
				const value = Reflect.get(object, prop, receiver);
				if (!DEV || !array || typeof prop !== 'string' || !mutating.has(prop)) return value;
				const method = value as (...args: unknown[]) => unknown;
				return function (this: unknown, ...args: unknown[]): unknown {
					return holdEager(() => method.apply(this, args));
				};
			}
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
				guard(length);
				const origin = sequence();
				for (let position = next as number; position < (length.v as number); position++) {
					const key = String(position);
					const item = sources.get(key);
					if (item === undefined) {
						const missing = make(ABSENT);
						sources.set(key, missing);
						if (DEV) tag(missing, labelFor(path, key));
					} else write(item, ABSENT, origin);
				}
				write(length, next, origin);
				write(keys, (keys.v as number) + 1, origin);
				return true;
			}
			assign(prop, next);
			return true;
		},
		deleteProperty(object, prop) {
			if (!tracked(prop)) return Reflect.deleteProperty(object, prop);
			const found = source(prop);
			if (found.v !== ABSENT) {
				guard(found);
				const origin = sequence();
				write(found, ABSENT, origin);
				write(keys, (keys.v as number) + 1, origin);
			}
			return true;
		},
		ownKeys(object) {
			get(keys);
			return untrack(() => {
				const own = Reflect.ownKeys(object).filter((key) => {
					const found = sources.get(key);
					return found === undefined || get(found) !== ABSENT;
				});
				for (const [key, found] of sources) {
					if (get(found) !== ABSENT && !own.includes(key)) own.push(key);
				}
				return own;
			});
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
			if (!tracked(prop)) return Reflect.defineProperty(object, prop, descriptor);
			if (
				!('value' in descriptor) ||
				descriptor.configurable === false ||
				descriptor.enumerable === false ||
				descriptor.writable === false
			)
				descriptorsFixed();
			assign(prop, descriptor.value);
			return true;
		}
	});
	if (DEV)
		labelled(wrapped, (label) => {
			if (relabelling) return;
			relabelling = true;
			try {
				path = label;
				tag(keys, `${path} version`);
				for (const [prop, found] of sources) tag(found, labelFor(path, prop));
			} finally {
				relabelling = false;
			}
		});
	return wrapped;
}
