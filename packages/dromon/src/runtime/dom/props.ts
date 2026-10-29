import { failure } from '../../shared/diagnostics.ts';
import { proxy } from '../reactivity/proxy.ts';
import { derived, set } from '../reactivity/sources.ts';
import { get, untrack } from '../reactivity/tracking.ts';

export const BINDABLE = 1;

export const LAZY = 2;

export const UPDATED = 4;

type Props = Record<PropertyKey, unknown>;

const entries = new WeakSet<object>();

export function entry(props: object): void {
	entries.add(props);
}

export type Accessor<T> = (value?: T) => T;

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
	let setter: ((value: T) => void) | undefined;
	if (bindable) {
		setter =
			Object.getOwnPropertyDescriptor(props, key)?.set ??
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
	if ((flags & UPDATED) === 0) return getter;
	if (setter !== undefined) {
		const write = setter;
		return function (this: unknown, value?: T): T {
			if (arguments.length > 0) {
				write(value as T);
				return value as T;
			}
			return getter();
		};
	}
	const local = derived(getter);
	if (bindable) get(local);
	return function (this: unknown, value?: T): T {
		if (arguments.length > 0) {
			const next = bindable ? proxy(value as T) : (value as T);
			set(local, next);
			if (fallbackValue !== undefined) fallbackValue = next;
			return value as T;
		}
		return get(local);
	};
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

export function propsId(): string {
	const registry = window as unknown as { __svelte?: { uid?: number } };
	const shared = (registry.__svelte ??= {});
	shared.uid ??= 1;
	return `c${shared.uid++}`;
}
