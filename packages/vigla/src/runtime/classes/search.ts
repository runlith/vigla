import { state } from '../reactivity/sources.ts';
import { get } from '../reactivity/reads.ts';
import { bump } from './subscriber.ts';

export interface Searched {
	search: string;
}

let attach: (params: ReactiveURLSearchParams, url: Searched) => void;
let refill: (params: ReactiveURLSearchParams, from: URLSearchParams) => void;

export class ReactiveURLSearchParams extends URLSearchParams {
	readonly #version = state(0);
	#url: Searched | null = null;
	#updating = false;

	static {
		attach = (params, url) => {
			params.#url = url;
		};
		refill = (params, from) => params.#refill(from);
	}

	#write(): void {
		const url = this.#url;
		if (url === null || this.#updating) return;
		this.#updating = true;
		try {
			const search = super.toString();
			url.search = search === '' ? '' : `?${search}`;
		} finally {
			this.#updating = false;
		}
	}

	#changed(): void {
		this.#write();
		bump(this.#version);
	}

	#refill(from: URLSearchParams): void {
		if (this.#updating || from.toString() === super.toString()) return;
		this.#updating = true;
		try {
			for (const key of [...super.keys()]) super.delete(key);
			for (const [key, value] of from) super.append(key, value);
		} finally {
			this.#updating = false;
		}
		bump(this.#version);
	}

	override append(name: string, value: string): void {
		super.append(name, value);
		this.#changed();
	}

	override delete(name: string, value?: string): void {
		const present = super.has(name, value);
		super.delete(name, value);
		if (present) this.#changed();
	}

	override set(name: string, value: string): void {
		const before = super.getAll(name);
		super.set(name, value);
		const after = super.getAll(name);
		if (before.length !== after.length || before.some((item, index) => item !== after[index]))
			this.#changed();
	}

	override sort(): void {
		super.sort();
		this.#changed();
	}

	override get(name: string): string | null {
		get(this.#version);
		return super.get(name);
	}

	override getAll(name: string): string[] {
		get(this.#version);
		return super.getAll(name);
	}

	override has(name: string, value?: string): boolean {
		get(this.#version);
		return super.has(name, value);
	}

	override forEach(
		callback: (value: string, key: string, parent: URLSearchParams) => void,
		thisArg?: unknown
	): void {
		get(this.#version);
		super.forEach(callback, thisArg);
	}

	override keys(): URLSearchParamsIterator<string> {
		get(this.#version);
		return super.keys();
	}

	override values(): URLSearchParamsIterator<string> {
		get(this.#version);
		return super.values();
	}

	override entries(): URLSearchParamsIterator<[string, string]> {
		get(this.#version);
		return super.entries();
	}

	override [Symbol.iterator](): URLSearchParamsIterator<[string, string]> {
		return this.entries();
	}

	override toString(): string {
		get(this.#version);
		return super.toString();
	}

	override get size(): number {
		get(this.#version);
		return super.size;
	}
}

export function bind(params: ReactiveURLSearchParams, url: Searched): void {
	attach(params, url);
}

export function replace(params: ReactiveURLSearchParams, from: URLSearchParams): void {
	refill(params, from);
}
