import type { Layer } from '../../shared/context.ts';
import { fail } from '../reactivity/effects.ts';
import { ambient } from '../reactivity/carried.ts';
import type { Effect } from '../reactivity/graph.ts';
import type { Cell } from '../reactivity/sources.ts';
import { collect, collected } from '../reactivity/collector.ts';
import { owner, setOwner, untrack, withoutReaction } from '../reactivity/tracking.ts';
import { layerOf } from './context.ts';

export interface Dependency {
	readonly version: number;
	settle(): void;
}

interface Read {
	readonly from: Dependency;
	readonly version: number;
}

export function track(from: Dependency): void {
	(collected() as Read[] | null)?.push({ from, version: from.version });
}

function unchanged(recorded: readonly Read[]): boolean {
	return untrack(() => {
		for (const read of recorded) {
			read.from.settle();
			if (read.from.version !== read.version) return false;
		}
		return true;
	});
}

class Value<T> implements Cell<T>, Dependency {
	version = 0;
	#value: T;

	constructor(value: T) {
		this.#value = value;
	}

	get current(): T {
		track(this);
		return this.#value;
	}

	set current(next: T) {
		if (Object.is(next, this.#value)) return;
		this.#value = next;
		this.version++;
	}

	settle(): void {}
}

class Memo<T> implements Cell<T>, Dependency {
	version = 0;
	readonly #fn: () => T;
	readonly #equals: (before: T, after: T) => boolean;
	readonly #scope: Effect | null = ambient();
	readonly #layer: Layer<Effect> | null = layerOf(this.#scope);
	#reads: Read[] | null = null;
	#assigned = false;
	#value = undefined as T;

	constructor(fn: () => T, equals: (before: T, after: T) => boolean = Object.is) {
		this.#fn = fn;
		this.#equals = equals;
	}

	get current(): T {
		this.settle();
		track(this);
		return this.#value;
	}

	set current(next: T) {
		this.settle();
		this.#assigned = true;
		this.#publish(next);
	}

	settle(): void {
		const kept = this.#scope !== null || this.#assigned;
		if (kept && this.#reads !== null && unchanged(this.#reads)) return;
		const first = this.#reads === null;
		this.#assigned = false;
		const next = this.#evaluate();
		if (first) {
			this.#value = next;
			this.version++;
		} else this.#publish(next);
	}

	#publish(next: T): void {
		if (this.#equals(this.#value, next)) return;
		this.#value = next;
		this.version++;
	}

	#evaluate(): T {
		const scope = this.#scope;
		const previous = setOwner(scope ?? owner);
		const active = scope?.context;
		if (scope !== null) scope.context = this.#layer;
		const recorded: Read[] = [];
		try {
			return withoutReaction(() => collect(recorded, this.#fn));
		} catch (error) {
			if (scope === null) throw error;
			fail(scope, error);
			return undefined as T;
		} finally {
			this.#reads = recorded;
			if (scope !== null) scope.context = active;
			setOwner(previous);
		}
	}
}

export function cell<T>(value: T): Cell<T> {
	return new Value(value);
}

export function memo<T>(fn: () => T, equals?: (before: T, after: T) => boolean): Cell<T> {
	return new Memo(fn, equals);
}
