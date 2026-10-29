import type { Source } from '../reactivity/graph.ts';
import { set, state } from '../reactivity/sources.ts';
import { get } from '../reactivity/tracking.ts';
import { bump } from './subscriber.ts';
import { keyed } from './local.ts';

export class ReactiveMap<K, V> extends Map<K, V> {
	readonly #keys = new Map<K, Source<number>>();
	readonly #version = state(0);
	readonly #size = state(0);

	constructor(entries?: Iterable<readonly [K, V]> | null) {
		super();
		if (entries !== null && entries !== undefined) {
			for (const [key, value] of entries) super.set(key, value);
			this.#size.v = super.size;
		}
	}

	#key(key: K): Source<number> | undefined {
		let source = this.#keys.get(key);
		if (source === undefined && super.has(key)) {
			source = keyed(this.#version, 0);
			this.#keys.set(key, source);
		}
		return source;
	}

	override has(key: K): boolean {
		const source = this.#key(key);
		if (source === undefined) {
			get(this.#version);
			return false;
		}
		get(source);
		return true;
	}

	override get(key: K): V | undefined {
		const source = this.#key(key);
		if (source === undefined) {
			get(this.#version);
			return undefined;
		}
		get(source);
		return super.get(key);
	}

	getOrInsert(key: K, value: V): V {
		if (!super.has(key)) this.set(key, value);
		return this.get(key) as V;
	}

	getOrInsertComputed(key: K, compute: (key: K) => V): V {
		if (!super.has(key)) this.set(key, compute(key));
		return this.get(key) as V;
	}

	override set(key: K, value: V): this {
		const source = this.#keys.get(key);
		const previous = super.get(key);
		super.set(key, value);
		if (source === undefined) {
			this.#keys.set(key, keyed(this.#version, 0));
			set(this.#size, super.size);
			bump(this.#version);
		} else if (previous !== value) {
			bump(source);
		}
		return this;
	}

	override delete(key: K): boolean {
		const source = this.#keys.get(key);
		const deleted = super.delete(key);
		if (source !== undefined) {
			this.#keys.delete(key);
			set(source, -1);
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
		set(this.#size, 0);
		for (const source of this.#keys.values()) set(source, -1);
		this.#keys.clear();
		bump(this.#version);
	}

	#all(): void {
		get(this.#version);
		const keys = this.#keys;
		if (keys.size !== super.size) {
			for (const key of super.keys()) {
				if (!keys.has(key)) keys.set(key, keyed(this.#version, 0));
			}
		}
		for (const source of keys.values()) get(source);
	}

	override forEach(callback: (value: V, key: K, map: Map<K, V>) => void, thisArg?: unknown): void {
		this.#all();
		super.forEach(callback, thisArg);
	}

	override keys(): MapIterator<K> {
		get(this.#version);
		return super.keys();
	}

	override values(): MapIterator<V> {
		this.#all();
		return super.values();
	}

	override entries(): MapIterator<[K, V]> {
		this.#all();
		return super.entries();
	}

	override [Symbol.iterator](): MapIterator<[K, V]> {
		return this.entries();
	}

	override get size(): number {
		get(this.#size);
		return super.size;
	}
}
