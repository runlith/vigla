import { failure } from '../../shared/diagnostics.ts';
import { close, empty, open } from '../../shared/markers.ts';
import { begin, end, push } from './context.ts';

export type Props = Record<string, unknown>;

export interface Style {
	readonly hash: string;
	readonly code: string;
}

class Global {
	#uid = 1;
	readonly prefix: string;
	readonly transformError: (error: unknown) => unknown;

	constructor(prefix: string, transformError?: (error: unknown) => unknown) {
		this.prefix = prefix;
		this.transformError = transformError ?? ((error) => error);
	}

	uid(): string {
		return `${this.prefix}s${this.#uid++}`;
	}

	readonly pending: Promise<unknown>[] = [];
	readonly styles = new Set<Style>();
	readonly titles: Output[] = [];

	track(promise: Promise<unknown>): void {
		promise.catch(() => {});
		this.pending.push(promise);
	}

	async settle(): Promise<void> {
		while (this.pending.length > 0) await Promise.all(this.pending.splice(0));
	}

	title(): string {
		let chosen: Output | null = null;
		let best: readonly number[] | null = null;
		for (const title of this.titles) {
			const path = title.path();
			if (path === null) continue;
			if (best === null || later(path, best)) {
				chosen = title;
				best = path;
			}
		}
		return chosen === null ? '' : chosen.collect(undefined, true).head;
	}
}

function later(path: readonly number[], than: readonly number[]): boolean {
	let index = 0;
	while (index < path.length && index < than.length && path[index] === than[index]) index++;
	if (index === path.length) return false;
	return index === than.length || (path[index] as number) > (than[index] as number);
}

export interface Content {
	head: string;
	body: string;
}

type Channel = 'body' | 'head' | 'title';

export class Output {
	readonly #parts: (string | Output)[] = [];
	readonly #parent: Output | null;
	readonly #channel: Channel;
	readonly global: Global;

	constructor(global: Global, parent: Output | null = null, channel?: Channel) {
		this.global = global;
		this.#parent = parent;
		this.#channel = channel ?? (parent === null || parent.#channel === 'body' ? 'body' : 'head');
	}

	push(html: string): void {
		this.#parts.push(html);
	}

	child(fn: (out: Output) => void | Promise<void>): void {
		this.#run(new Output(this.global, this), fn);
	}

	head(fn: (out: Output) => void | Promise<void>): void {
		this.#run(new Output(this.global, this, 'head'), fn);
	}

	title(fn: (out: Output) => void | Promise<void>): void {
		const inner = new Output(this.global, this, 'title');
		this.global.titles.push(inner);
		this.#run(inner, fn);
	}

	#run(inner: Output, fn: (out: Output) => void | Promise<void>): void {
		this.#parts.push(inner);
		const result = fn(inner);
		if (result instanceof Promise) this.global.track(result);
	}

	path(): number[] | null {
		const parent = this.#parent;
		if (parent === null) return [];
		const above = parent.path();
		const index = parent.#parts.indexOf(this);
		return above === null || index === -1 ? null : [...above, index];
	}

	mark(): number {
		return this.#parts.length;
	}

	truncate(mark: number): void {
		this.#parts.length = mark;
	}

	collect(content: Content = { head: '', body: '' }, title = false): Content {
		for (const part of this.#parts) {
			if (typeof part !== 'string') {
				if (part.#channel !== 'title' || title) part.collect(content, title);
			} else if (this.#channel === 'body') content.body += part;
			else content.head += part;
		}
		return content;
	}

	toString(): string {
		return this.collect().body;
	}
}

export type Component<P extends Props = Props> = (out: Output, props: P) => void;

export interface RenderOptions<P extends Props> {
	readonly props?: P;
	readonly idPrefix?: string;
	readonly context?: Map<unknown, unknown>;
	readonly transformError?: (error: unknown) => unknown;
}

export interface Hashes {
	readonly script: readonly string[];
}

export interface Rendered {
	readonly head: string;
	readonly body: string;
	readonly hashes: Hashes;
}

export type Rendering = Rendered & PromiseLike<Rendered>;

export function render<P extends Props>(
	component: Component<P>,
	options: RenderOptions<P> = {}
): Rendering {
	const prefix = options.idPrefix;
	if (prefix?.includes('--')) {
		throw failure('invalid_id_prefix', 'The `idPrefix` option cannot include `--`.');
	}
	const global = new Global(prefix ? `${prefix}-` : '', options.transformError);
	const out = new Output(global);
	const saved = begin();
	try {
		push(options.context);
		out.push(open);
		component(out, options.props ?? ({} as P));
		out.push(close);
	} finally {
		end(saved);
	}
	const result = (): Rendered => {
		const content = out.collect();
		let head = content.head + global.title();
		for (const { hash, code } of global.styles) head += `<style id="${hash}">${code}</style>`;
		return { head, body: content.body, hashes: { script: [] } };
	};
	if (global.pending.length === 0) {
		const rendered = result();
		return {
			...rendered,
			then(fulfilled, rejected) {
				return Promise.resolve(rendered).then(fulfilled, rejected);
			}
		};
	}
	const settled = global.settle().then(result);
	const synchronous = (): never => {
		throw failure('await_invalid', 'Encountered asynchronous work while rendering synchronously.');
	};
	return {
		get head(): string {
			return synchronous();
		},
		get body(): string {
			return synchronous();
		},
		get hashes(): Hashes {
			return synchronous();
		},
		then(fulfilled, rejected) {
			return settled.then(fulfilled, rejected);
		}
	};
}

export function head(out: Output, hash: string, fn: (out: Output) => void): void {
	out.head((inner) => {
		inner.push(`<!--${hash}-->`);
		inner.child(fn);
		inner.push(empty);
	});
}

export interface BoundaryProps {
	readonly failed?: ((out: Output, error: unknown, reset: () => void) => void) | null;
}

function serialized(error: unknown): string {
	const json = JSON.stringify(error) ?? 'null';
	return `<!--[?${json.replace(/>/g, '\\u003e').replace(/</g, '\\u003c')}-->`;
}

export function boundary(out: Output, props: BoundaryProps, children: (out: Output) => void): void {
	const mark = out.mark();
	try {
		children(out);
	} catch (error) {
		const failed = props.failed;
		if (!failed) throw error;
		out.truncate(mark);
		const transformed = out.global.transformError(error);
		if (transformed !== null && typeof (transformed as PromiseLike<unknown>)?.then === 'function') {
			throw failure(
				'await_invalid',
				'Encountered asynchronous work while rendering synchronously.'
			);
		}
		out.push(serialized(transformed));
		failed(out, transformed, () => {});
		out.push(close);
	}
}

export function appendStyles(out: Output, style: Style): void {
	out.global.styles.add(style);
}

export function propsId(out: Output): string {
	const id = out.global.uid();
	out.push(`<!--$${id}-->`);
	return id;
}

export function derived<T>(fn: () => T): (value?: T) => T {
	let computed = false;
	let value = undefined as T;
	return function (next?: T): T {
		if (arguments.length > 0) {
			value = next as T;
			computed = true;
			return value;
		}
		if (!computed) {
			value = fn();
			computed = true;
		}
		return value;
	};
}

export function held<T>(value: T): (next?: T) => T {
	return derived(() => value);
}

export function iterate<T>(
	collection: Iterable<T> | ArrayLike<T> | null | undefined
): ArrayLike<T> {
	if (collection == null) return [];
	return (collection as ArrayLike<T>).length !== undefined
		? (collection as ArrayLike<T>)
		: Array.from(collection as Iterable<T>);
}

export function spreadProps(
	...sources: (Record<PropertyKey, unknown> | null | undefined)[]
): Record<PropertyKey, unknown> {
	const merged: Record<PropertyKey, unknown> = {};
	for (const source of sources) {
		if (source == null) continue;
		for (const key of Object.keys(source)) {
			const descriptor = Object.getOwnPropertyDescriptor(source, key);
			if (descriptor !== undefined)
				Object.defineProperty(merged, key, { ...descriptor, configurable: true, enumerable: true });
		}
	}
	return merged;
}

export function snapshot<T>(value: T): T {
	return typeof value === 'object' && value !== null ? structuredClone(value) : value;
}
