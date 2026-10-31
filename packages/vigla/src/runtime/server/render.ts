import { failure } from '../../shared/diagnostics.ts';
import { isRendering } from './context.ts';
import { format as nativeFormat, type Format } from '../../shared/format.ts';
import { Data, type Csp, type Script } from './hydration.ts';
import { isVoid } from '../../shared/html.ts';
import { close, empty, open } from '../../shared/markers.ts';
import { destroy, detached } from '../reactivity/effects.ts';
import { owner } from '../reactivity/tracking.ts';
import { begin, capture, end, push, storeOf } from './context.ts';

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
		this.transformError =
			transformError ??
			((error) => {
				throw error;
			});
	}

	uid(): string {
		return `${this.prefix}s${this.#uid++}`;
	}

	readonly styles = new Set<Style>();
	readonly titles: Output[] = [];

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

type Failed = (out: Output, error: unknown, reset: () => void) => void;

interface Recovery {
	readonly failed: Failed;
	readonly restore: () => void;
}

export class Output {
	readonly #parts: (string | Output)[] = [];
	readonly #parent: Output | null;
	readonly #channel: Channel;
	#pending: Promise<void> | null = null;
	#recovery: Recovery | null = null;
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
		if (result instanceof Promise) inner.#wait(result);
	}

	#wait(promise: Promise<void>): void {
		promise.catch(() => {});
		this.#pending = promise;
	}

	get asynchronous(): boolean {
		return (
			this.#pending !== null ||
			this.#parts.some((part) => typeof part !== 'string' && part.asynchronous)
		);
	}

	async settle(): Promise<void> {
		try {
			await this.#pending;
			const children: Promise<void>[] = [];
			for (const part of this.#parts) if (typeof part !== 'string') children.push(part.settle());
			await Promise.all(children);
		} catch (error) {
			this.#recover(error);
			await this.settle();
		}
	}

	boundary(props: BoundaryProps, children: (out: Output) => void | Promise<void>): void {
		const inner = new Output(this.global, this);
		if (props.failed) inner.#recovery = { failed: props.failed, restore: capture() };
		try {
			this.#run(inner, children);
		} catch (error) {
			inner.#recover(error);
		}
	}

	#recover(error: unknown): void {
		const recovery = this.#recovery;
		if (recovery === null) throw error;
		this.#recovery = null;
		this.#pending = null;
		this.#parts.length = 0;
		recovery.restore();
		const transformed = this.global.transformError(error);
		const render = (value: unknown): void => {
			recovery.restore();
			this.push(serialized(value));
			recovery.failed(this, value, () => {});
			this.push(close);
		};
		if (transformed !== null && typeof (transformed as PromiseLike<unknown>)?.then === 'function') {
			this.#wait(Promise.resolve(transformed).then(render));
		} else {
			render(transformed);
		}
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
	readonly format?: Format;
	readonly csp?: Csp;
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
	if (options.csp?.hash && options.csp.nonce) {
		throw failure('invalid_csp', 'A render cannot use both a CSP hash and a nonce');
	}
	const prefix = options.idPrefix;
	if (prefix?.includes('--')) {
		throw failure('invalid_id_prefix', 'The `idPrefix` option cannot include `--`.');
	}
	const global = new Global(prefix ? `${prefix}-` : '', options.transformError);
	const out = new Output(global);
	const caller = owner;
	const scope = detached(null, caller);
	const data = storeOf(caller) ?? new Data();
	const saved = begin(scope, data);
	try {
		push(options.context);
		out.push(open);
		component(out, options.props ?? ({} as P));
		out.push(close);
	} catch (error) {
		end(saved);
		destroy(scope);
		throw error;
	}
	end(saved);
	const result = (script?: Script): Rendered => {
		const content = out.collect();
		let head = (script?.html ?? '') + content.head + global.title();
		for (const { hash, code } of global.styles) head += `<style id="${hash}">${code}</style>`;
		return { head, body: content.body, hashes: { script: script?.hash ? [script.hash] : [] } };
	};
	if (!out.asynchronous && data.size === 0) {
		const rendered = result();
		destroy(scope);
		return {
			...rendered,
			then(fulfilled, rejected) {
				return Promise.resolve(rendered).then(fulfilled, rejected);
			}
		};
	}
	const settled = out
		.settle()
		.then(async () => result(await data.script(options.format ?? nativeFormat, options.csp)))
		.finally(() => destroy(scope));
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

const validTag =
	/^[a-zA-Z][a-zA-Z0-9]*(-[-a-zA-Z0-9._\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u{10000}-\u{EFFFF}]*)?$/u;

const rawText = new Set(['textarea', 'script', 'style', 'title']);

export function element(
	out: Output,
	tag: unknown,
	attributes: () => string,
	children: (out: Output) => void
): void {
	out.push(empty);
	if (tag) {
		const name = String(tag);
		if (!validTag.test(name)) {
			throw failure(
				'dynamic_element_invalid_tag',
				`\`<svelte:element this="${name}">\` is not a valid element name — the element will not be rendered`
			);
		}
		out.push(`<${name}${attributes()}>`);
		if (!isVoid(name)) {
			out.child(children);
			if (!rawText.has(name)) out.push(empty);
			out.push(`</${name}>`);
		}
	}
	out.push(empty);
}

export function head(out: Output, hash: string, fn: (out: Output) => void): void {
	out.head((inner) => {
		inner.push(`<!--${hash}-->`);
		inner.child(fn);
		inner.push(empty);
	});
}

export interface BoundaryProps {
	readonly failed?: Failed | null;
}

function serialized(error: unknown): string {
	const json = JSON.stringify(error) ?? 'null';
	return `<!--[?${json.replace(/>/g, '\\u003e').replace(/</g, '\\u003c')}-->`;
}

export function boundary(out: Output, props: BoundaryProps, children: (out: Output) => void): void {
	out.boundary(props, children);
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
