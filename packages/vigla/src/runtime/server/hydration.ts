import { DEV } from 'esm-env';
import { uneval } from 'devalue';
import { failure, warn } from '../../shared/diagnostics.ts';
import { escapeAttribute } from '../../shared/escape.ts';
import type { Format } from '../../shared/format.ts';
import { hydrationData, openStore } from './context.ts';
import { getOwner } from '../reactivity/owners.ts';

export interface Csp {
	readonly nonce?: string;
	readonly hash?: boolean;
}

export interface Script {
	readonly html: string;
	readonly hash: string | null;
}

interface Slot {
	pending: boolean;
	encoded: string;
	ready: Promise<void>;
}

const placeholder = /\/\*<p(\d+)>\*\/0/g;

class Entry {
	readonly value: unknown;
	readonly #key: string;
	readonly #slots: Slot[] = [];
	readonly #indices = new WeakMap<object, number>();
	readonly #encoded: string;
	#ready: Promise<void> | null = null;
	readonly #serialized = new Map<string, Promise<string>>();

	constructor(key: string, value: unknown) {
		this.value = value;
		this.#key = key;
		this.#encoded = this.#encode(value);
	}

	get asynchronous(): boolean {
		return this.#slots.length > 0;
	}

	get unresolved(): boolean {
		return this.#slots.some((slot) => slot.pending);
	}

	#error(error: unknown): Error {
		return failure(
			'hydratable_serialization_failed',
			`Failed to serialize hydratable key ${JSON.stringify(this.#key)}: ${String(error)}`
		);
	}

	#encode(value: unknown): string {
		try {
			return uneval(value, (candidate) => {
				if (Object.prototype.toString.call(candidate) !== '[object Promise]') return;
				let index = this.#indices.get(candidate);
				if (index === undefined) {
					index = this.#slots.length;
					this.#indices.set(candidate, index);
					const slot: Slot = { pending: true, encoded: '', ready: Promise.resolve() };
					this.#slots.push(slot);
					slot.ready = Promise.resolve(candidate).then(
						(resolved) => {
							slot.pending = false;
							slot.encoded = this.#encode(resolved);
						},
						(error: unknown) => {
							slot.pending = false;
							throw this.#error(error);
						}
					);
					slot.ready.catch(() => {});
				}
				return `/*<p${index}>*/0`;
			});
		} catch (error) {
			throw this.#error(error);
		}
	}

	#expand(
		source: string,
		resolver: string,
		cache: Map<number, string>,
		visiting: Set<number>
	): string {
		return source.replace(placeholder, (_, index: string) => {
			const id = Number(index);
			let encoded = cache.get(id);
			if (encoded !== undefined) return encoded;
			if (visiting.has(id)) throw this.#error('A promise resolves to a graph containing itself');
			visiting.add(id);
			encoded = `${resolver}(${this.#expand(this.#slots[id]!.encoded, resolver, cache, visiting)})`;
			visiting.delete(id);
			cache.set(id, encoded);
			return encoded;
		});
	}

	#prepare(): Promise<void> {
		return (this.#ready ??= (async () => {
			for (let index = 0; index < this.#slots.length; index++) await this.#slots[index]!.ready;
		})());
	}

	async identifiers(): Promise<Set<string>> {
		await this.#prepare();
		const names = new Set<string>();
		for (const source of [this.#encoded, ...this.#slots.map((slot) => slot.encoded)]) {
			for (const name of source.match(/[$A-Z_a-z][$\w]*/g) ?? []) names.add(name);
		}
		return names;
	}

	serialize(resolver: string): Promise<string> {
		let serialized = this.#serialized.get(resolver);
		if (serialized === undefined) {
			serialized = this.#prepare().then(() =>
				this.#expand(this.#encoded, resolver, new Map(), new Set())
			);
			this.#serialized.set(resolver, serialized);
		}
		return serialized;
	}
}

export class Data {
	readonly #entries = new Map<string, Entry>();
	readonly #comparisons: [Entry, Entry][] = [];
	readonly #beforeSnapshot?: () => void;

	constructor(beforeSnapshot?: () => void) {
		this.#beforeSnapshot = beforeSnapshot;
	}

	get needsSnapshot(): boolean {
		return this.size > 0 || this.#beforeSnapshot !== undefined;
	}

	get size(): number {
		return this.#entries.size;
	}

	read<T>(key: string, fn: () => T): T {
		const existing = this.#entries.get(key);
		if (existing !== undefined) {
			if (DEV) this.#comparisons.push([existing, new Entry(key, fn())]);
			return existing.value as T;
		}
		const value = fn();
		this.#entries.set(key, new Entry(key, value));
		return value;
	}

	async script(format: Format, csp: Csp | undefined): Promise<Script> {
		this.#beforeSnapshot?.();
		if (this.size === 0) return { html: '', hash: null };
		if (DEV)
			for (const [key, entry] of this.#entries) {
				if (entry.unresolved)
					warn(
						'unresolved_hydratable',
						`A \`hydratable\` value with key \`${key}\` was created, but at least part of it was not used during the render.`
					);
			}
		const names = new Set<string>();
		const values = new Set([...this.#entries.values(), ...this.#comparisons.flat()]);
		for (const entry of values) for (const name of await entry.identifiers()) names.add(name);
		let resolver = 'r';
		while (names.has(resolver)) resolver += '_';
		for (const [first, next] of this.#comparisons) {
			if ((await first.serialize(resolver)) !== (await next.serialize(resolver))) {
				throw failure(
					'hydratable_clobbering',
					'A hydratable key was read with different values in the same render'
				);
			}
		}
		const entries: string[] = [];
		let promises = false;
		for (const [key, entry] of this.#entries) {
			entries.push(`[${uneval(key)},${await entry.serialize(resolver)}]`);
			promises ||= entry.asynchronous;
		}
		const global = /^[$A-Z_a-z][$\w]*$/.test(format.global)
			? `window.${format.global}`
			: `window[${uneval(format.global)}]`;
		let prelude = `const h = (${global} ??= {}).h ??= new Map();`;
		if (promises) prelude = `const ${resolver} = (v) => Promise.resolve(v);\n\t\t\t\t${prelude}`;
		const body = `
			{
				${prelude}

				for (const [k, v] of [
					${entries.join(',\n\t\t\t\t\t')}
				]) {
					h.set(k, v);
				}
			}
		`;
		let hash: string | null = null;
		if (csp?.hash) {
			const bytes = new Uint8Array(
				await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))
			);
			hash = `sha256-${btoa(String.fromCharCode(...bytes))}`;
		}
		const nonce = csp?.nonce ? ` nonce="${escapeAttribute(csp.nonce)}"` : '';
		return { html: `\n\t\t<script${nonce}>${body}</script>`, hash };
	}
}

export function hydratable<T>(key: string, fn: () => T): T {
	const data = hydrationData();
	return data === null ? fn() : data.read(key, fn);
}

export function hydrated<T>(key: string, fn: () => T): T {
	return hydratable(key, fn);
}

export interface HydrationOptions {
	readonly format?: Format;
	readonly target?: ParentNode;
	readonly beforeSnapshot?: () => void;
}

export function openHydration(options: HydrationOptions = {}): () => void {
	const owner = getOwner();
	const publish = options.beforeSnapshot;
	openStore(new Data(owner && publish ? () => owner.run(publish) : undefined));
	return () => {};
}
