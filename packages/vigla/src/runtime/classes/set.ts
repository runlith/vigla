import type { Source } from '../reactivity/graph.ts';
import { set, state } from '../reactivity/sources.ts';
import { get } from '../reactivity/reads.ts';
import { keyed } from './local.ts';
import { bump } from './subscriber.ts';

interface Like<T> {
	readonly size: number;
	has(value: T): boolean;
	keys(): Iterator<T>;
}

interface Algebra {
	union<T>(this: Set<T>, other: Like<unknown>): Set<unknown>;
	intersection<T>(this: Set<T>, other: Like<unknown>): Set<unknown>;
	difference<T>(this: Set<T>, other: Like<unknown>): Set<unknown>;
	symmetricDifference<T>(this: Set<T>, other: Like<unknown>): Set<unknown>;
	isSubsetOf<T>(this: Set<T>, other: Like<unknown>): boolean;
	isSupersetOf<T>(this: Set<T>, other: Like<unknown>): boolean;
	isDisjointFrom<T>(this: Set<T>, other: Like<unknown>): boolean;
}

const native = Set.prototype as unknown as Algebra;

export class ReactiveSet<T> extends Set<T> {
	readonly #values = new Map<T, Source<boolean>>();
	readonly #version = state(0);
	readonly #size = state(0);

	constructor(values?: Iterable<T> | null) {
		super();
		if (values !== null && values !== undefined) {
			for (const value of values) super.add(value);
			this.#size.v = super.size;
		}
	}

	override has(value: T): boolean {
		const present = super.has(value);
		let source = this.#values.get(value);
		if (source === undefined) {
			if (!present) {
				get(this.#version);
				return false;
			}
			source = keyed(this.#version, true);
			this.#values.set(value, source);
		}
		get(source);
		return present;
	}

	override add(value: T): this {
		if (!super.has(value)) {
			super.add(value);
			set(this.#size, super.size);
			bump(this.#version);
		}
		return this;
	}

	override delete(value: T): boolean {
		const deleted = super.delete(value);
		const source = this.#values.get(value);
		if (source !== undefined) {
			this.#values.delete(value);
			set(source, false);
		}
		if (deleted) {
			set(this.#size, super.size);
			bump(this.#version);
		}
		return deleted;
	}

	override clear(): void {
		if (super.size === 0) return;
		super.clear();
		for (const source of this.#values.values()) set(source, false);
		this.#values.clear();
		set(this.#size, 0);
		bump(this.#version);
	}

	override forEach(callback: (value: T, key: T, set: Set<T>) => void, thisArg?: unknown): void {
		get(this.#version);
		super.forEach(callback, thisArg);
	}

	override keys(): SetIterator<T> {
		return this.values();
	}

	override values(): SetIterator<T> {
		get(this.#version);
		return super.values();
	}

	override entries(): SetIterator<[T, T]> {
		get(this.#version);
		return super.entries();
	}

	override [Symbol.iterator](): SetIterator<T> {
		return this.keys();
	}

	override get size(): number {
		return get(this.#size);
	}

	union<U>(other: Like<U>): ReactiveSet<T | U> {
		get(this.#version);
		return new ReactiveSet(native.union.call(this, other) as Set<T | U>);
	}

	intersection<U>(other: Like<U>): ReactiveSet<T & U> {
		get(this.#version);
		return new ReactiveSet(native.intersection.call(this, other) as Set<T & U>);
	}

	difference<U>(other: Like<U>): ReactiveSet<T> {
		get(this.#version);
		return new ReactiveSet(native.difference.call(this, other) as Set<T>);
	}

	symmetricDifference<U>(other: Like<U>): ReactiveSet<T | U> {
		get(this.#version);
		return new ReactiveSet(native.symmetricDifference.call(this, other) as Set<T | U>);
	}

	isSubsetOf(other: Like<unknown>): boolean {
		get(this.#version);
		return native.isSubsetOf.call(this, other);
	}

	isSupersetOf(other: Like<unknown>): boolean {
		get(this.#version);
		return native.isSupersetOf.call(this, other);
	}

	isDisjointFrom(other: Like<unknown>): boolean {
		get(this.#version);
		return native.isDisjointFrom.call(this, other);
	}
}
