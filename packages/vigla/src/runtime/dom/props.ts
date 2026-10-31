import { failure } from '../../shared/diagnostics.ts';
import type { Effect } from '../reactivity/graph.ts';
import { proxy } from '../reactivity/proxy.ts';
import { derived, set } from '../reactivity/sources.ts';
import { get, owner, untrack } from '../reactivity/tracking.ts';
import { advance, COMMENT, cursor, hydrating } from './hydration.ts';

export const BINDABLE = 1;

export const LAZY = 2;

export const UPDATED = 4;

type Props = Record<PropertyKey, unknown>;

const entries = new WeakSet<object>();
const mutableGetters = new WeakSet<object>();
const mutableAccessors = new WeakSet<object>();

export function mutableProps<T extends object>(props: T, keys: readonly string[]): T {
	for (const key of keys) {
		const getter = Object.getOwnPropertyDescriptor(props, key)?.get;
		if (getter !== undefined) mutableGetters.add(getter);
	}
	return props;
}

export function forwardProps<T extends object, V>(props: T, key: string, accessor: Accessor<V>): T {
	return mutableAccessors.has(accessor) ? mutableProps(props, [key]) : props;
}

function marked<T>(accessor: Accessor<T>, mutable: boolean): Accessor<T> {
	if (mutable) mutableAccessors.add(accessor);
	return accessor;
}

export function entry(props: object): void {
	entries.add(props);
}

export type Accessor<T> = (value?: T, mutation?: boolean) => T;

export function mutateProp<T, R>(accessor: Accessor<T>, result: R): R {
	accessor(undefined, true);
	return result;
}

export function prop<T>(
	props: Props,
	key: string,
	flags: number,
	fallback?: T | (() => T)
): Accessor<T> {
	const bindable = (flags & BINDABLE) !== 0;
	const lazy = (flags & LAZY) !== 0;
	const computed = lazy ? derived(fallback as () => T) : null;
	let fallbackValue = lazy ? undefined : (fallback as T | undefined);
	const getFallback = (): T => (computed !== null ? get(computed) : (fallbackValue as T));
	const descriptor = Object.getOwnPropertyDescriptor(props, key);
	const mutable = descriptor?.get !== undefined && mutableGetters.has(descriptor.get);
	let setter: ((value: T) => void) | undefined;
	if (bindable) {
		setter =
			descriptor?.set ??
			(entries.has(props) && key in props
				? (value: T) => {
						props[key] = value;
					}
				: undefined);
	}
	const initial = untrack(() => props[key]);
	if (initial === undefined && fallback !== undefined && setter !== undefined) {
		throw failure(
			'props_invalid_value',
			`Cannot do \`bind:${key}={undefined}\` when \`${key}\` has a fallback value`
		);
	}
	const getter = (): T => {
		const value = props[key] as T;
		return value === undefined ? getFallback() : value;
	};
	if ((flags & UPDATED) === 0) return marked(getter, mutable);
	if (setter !== undefined) {
		const write = setter;
		return marked(function (this: unknown, value?: T, mutation = false): T {
			if (arguments.length > 0) {
				if (!mutation) write(value as T);
				else if (mutable) write(getter());
				return value as T;
			}
			return getter();
		}, mutable);
	}
	const local = derived(getter);
	if (bindable) get(local);
	return marked(function (this: unknown, value?: T, mutation = false): T {
		if (arguments.length > 0) {
			if (mutation) return value as T;
			const next = bindable ? proxy(value as T) : (value as T);
			set(local, next);
			if (fallbackValue !== undefined) fallbackValue = next;
			return value as T;
		}
		return get(local);
	}, mutable);
}

function step<T>(value: T, delta: number): T {
	return (typeof value === 'bigint' ? value + BigInt(delta) : (value as number) + delta) as T;
}

export function updateProp<T>(accessor: Accessor<T>, delta = 1): T {
	const value = accessor();
	accessor(step(value, delta));
	return value;
}

export function updatePropPre<T>(accessor: Accessor<T>, delta = 1): T {
	return accessor(step(accessor(), delta));
}

export function rest(props: Props, excluded: readonly string[]): Props {
	const hidden = new Set<PropertyKey>(excluded);
	return new Proxy(props, {
		get(target, key) {
			return hidden.has(key) ? undefined : target[key];
		},
		set(target, key, value) {
			if (hidden.has(key)) return false;
			target[key] = value;
			return true;
		},
		has(target, key) {
			return !hidden.has(key) && key in target;
		},
		ownKeys(target) {
			return Reflect.ownKeys(target).filter((key) => !hidden.has(key));
		},
		getOwnPropertyDescriptor(target, key) {
			if (hidden.has(key)) return undefined;
			const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
			if (descriptor !== undefined && 'value' in descriptor) {
				return { ...descriptor, value: target[key] };
			}
			return descriptor;
		}
	});
}

const issued = new WeakMap<Effect, number>();
const mounts = new WeakSet<Effect>();

export function mountRoot(effect: Effect): void {
	mounts.add(effect);
}

export function propsId(): string {
	if (hydrating && cursor.nodeType === COMMENT) {
		const data = (cursor as Comment).data;
		if (data.charCodeAt(0) === 36) {
			advance();
			return data.slice(1);
		}
	}
	let top = owner as Effect;
	while (top.parent !== null && !mounts.has(top)) top = top.parent;
	const next = (issued.get(top) ?? 0) + 1;
	issued.set(top, next);
	return `c${next}`;
}
