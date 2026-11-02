import { isRendering } from './context.ts';

export type Derived<T> = (value?: T) => T;

export function derived<T>(fn: () => T): Derived<T> {
	const memoize = isRendering();
	let computed = false;
	let value = undefined as T;
	let override: T | undefined;
	return function (next?: T): T {
		if (arguments.length > 0) {
			override = next;
			return next as T;
		}
		if (override != null) return override;
		if (!memoize || !computed) {
			value = fn();
			computed = true;
		}
		return value;
	};
}

export function updateDerived<T extends number | bigint>(
	target: Derived<T>,
	delta: 1 | -1 = 1,
	prefix = false
): number | bigint {
	let value = target();
	const previous = delta === 1 ? value++ : value--;
	target(value);
	return prefix ? value : previous;
}

export function held<T>(value: T): Derived<T> {
	return derived(() => value);
}
