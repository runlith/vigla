import { DEV } from 'esm-env';
import { failure } from '../../shared/diagnostics.ts';
import type { Placed } from './placement.ts';
import { format as nativeFormat, type Format } from '../../shared/format.ts';
import { Data, type Csp, type Script } from './hydration.ts';
import { isVoid } from '../../shared/html.ts';
import { close, empty, open } from '../../shared/markers.ts';
import { detached } from '../reactivity/effects.ts';
import { owner } from '../reactivity/tracking.ts';
import { begin, capture, end, enter, finish, push, storeOf, type Instance } from './context.ts';
import { attributes } from './attributes.ts';
import type { StyleDirectives } from '../../shared/attributes.ts';

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

interface Selection {
	readonly value: unknown;
	readonly multiple: boolean;
}

interface OptionValue {
	value: unknown;
	present: boolean;
}

export class Settlement {
	invalidated = false;

	invalidate(): void {
		this.invalidated = true;
	}
}

export class Output {
	readonly #parts: (string | Output | (() => string) | Instance)[] = [];
	readonly #parent: Output | null;
	readonly #channel: Channel;
	#pending: Promise<void> | null = null;
	#settlement: Settlement | null = null;
	#recovery: Recovery | null = null;
	#selection: Selection | null;
	#optionValue: OptionValue | null;
	#valueTransparent = false;
	readonly global: Global;
	declare element: Placed | null;
	declare placed: Placed | null;

	constructor(global: Global, parent: Output | null = null, channel?: Channel) {
		this.global = global;
		if (DEV) this.element = this.placed = parent === null ? null : parent.element;
		this.#parent = parent;
		this.#channel = channel ?? (parent === null || parent.#channel === 'body' ? 'body' : 'head');
		this.#selection = parent === null ? null : parent.#selection;
		this.#optionValue = parent === null ? null : parent.#optionValue;
	}

	push(html: string): void {
		this.#parts.push(html);
	}

	child(fn: (out: Output) => void | Promise<void>, valueTransparent = false): void {
		const inner = new Output(this.global, this);
		inner.#valueTransparent = valueTransparent;
		this.#run(inner, fn);
	}

	invalidate(): void {
		for (let at: Output | null = this; at !== null; at = at.#parent) {
			if (at.#settlement !== null) {
				at.#settlement.invalidate();
				return;
			}
		}
	}

	stabilize(settlement: Settlement, fn: (out: Output) => void, done?: () => void): void {
		const restore = capture();
		this.child((container) => {
			const pass = (): void | Promise<void> => {
				for (;;) {
					const inner = new Output(this.global, container);
					settlement.invalidated = false;
					inner.#settlement = settlement;
					container.#parts.length = 0;
					container.#parts.push(inner);
					const previous = enter(inner);
					try {
						fn(inner);
					} finally {
						enter(previous);
					}
					if (inner.asynchronous) {
						return inner.settle().then(() => {
							restore();
							if (settlement.invalidated) return pass();
							done?.();
						});
					}
					if (!settlement.invalidated) {
						done?.();
						return;
					}
				}
			};
			return pass();
		});
	}

	select(
		given: Record<string, unknown>,
		hash: string | null,
		classes: Readonly<Record<string, unknown>> | null,
		styles: StyleDirectives | null,
		flags: number,
		fn: (out: Output) => void
	): void {
		const { value, defaultValue, ...rest } = given;
		if (rest.multiple === '') rest.multiple = true;
		this.push(`<select${attributes(rest, hash, classes, styles, flags)}>`);
		const inner = new Output(this.global, this);
		inner.#selection = {
			value: value === undefined ? defaultValue : value,
			multiple: !!rest.multiple
		};
		this.#run(inner, fn);
		this.push('</select>');
	}

	option(
		given: Record<string, unknown>,
		hash: string | null,
		classes: Readonly<Record<string, unknown>> | null,
		styles: StyleDirectives | null,
		flags: number,
		fn: (out: Output) => void
	): void {
		const inner = new Output(this.global, this);
		const body = new Output(this.global, inner);
		const implicit: OptionValue = { value: undefined, present: false };
		const selected = Object.keys(given).some((key) => {
			const value = given[key];
			return (
				key.toLowerCase() === 'selected' &&
				typeof value !== 'function' &&
				value != null &&
				(value === '' || !!value)
			);
		});
		const serialized = attributes(given, hash, classes, styles, flags);
		body.#optionValue = implicit;
		inner.#parts.push(() => {
			const value = Object.hasOwn(given, 'value')
				? given.value
				: implicit.present
					? implicit.value
					: body.#optionText().replaceAll(empty, '');
			const selection = inner.#selection;
			const matched =
				selection !== null &&
				(selection.multiple && Array.isArray(selection.value)
					? selection.value.includes(value)
					: selection.value === value);
			return `<option${serialized}${matched && !selected ? ' selected=""' : ''}>`;
		});
		this.#parts.push(inner);
		inner.#run(body, fn);
		inner.push('</option>');
	}

	optionValue<T>(value: T): T {
		if (this.#optionValue !== null) {
			this.#optionValue.value = value;
			this.#optionValue.present = true;
		}
		return value;
	}

	#optionText(): string {
		let text = '';
		for (const part of this.#parts) {
			if (typeof part === 'string') text += part;
			else if (typeof part === 'function') text += part();
			else if (part instanceof Output && part.#channel === this.#channel)
				text += part.#optionText();
		}
		if (this.#valueTransparent && text.startsWith(open) && text.endsWith(close)) {
			return text.slice(open.length, -close.length);
		}
		return text;
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
		const previous = enter(inner);
		let result: void | Promise<void>;
		try {
			result = fn(inner);
		} finally {
			enter(previous);
		}
		if (result instanceof Promise) inner.#wait(result);
	}

	place(instance: Instance): void {
		this.#parts.push(instance);
	}

	instances(visit: (instance: Instance) => void): void {
		for (const part of this.#parts) {
			if (part instanceof Output) part.instances(visit);
			else if (typeof part === 'object') visit(part);
		}
	}

	#wait(promise: Promise<void>): void {
		promise.catch(() => {});
		this.#pending = promise;
	}

	get asynchronous(): boolean {
		return (
			this.#pending !== null ||
			this.#parts.some((part) => part instanceof Output && part.asynchronous)
		);
	}

	async settle(): Promise<void> {
		try {
			await this.#pending;
			const children: Promise<void>[] = [];
			for (const part of this.#parts) if (part instanceof Output) children.push(part.settle());
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
		if (DEV) this.element = this.placed;
		recovery.restore();
		const transformed = this.global.transformError(error);
		const render = (value: unknown): void => {
			recovery.restore();
			this.push(serialized(value));
			const previous = enter(this);
			try {
				recovery.failed(this, value, () => {});
			} finally {
				enter(previous);
			}
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
			if (part instanceof Output) {
				if (part.#channel !== 'title' || title) part.collect(content, title);
			} else if (typeof part !== 'object') {
				const html = typeof part === 'function' ? part() : part;
				if (this.#channel === 'body') content.body += html;
				else content.head += html;
			}
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
	readonly inheritContext?: boolean;
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
	scope.scope = true;
	const current = begin(
		scope,
		storeOf(caller) ?? new Data(),
		out,
		options.inheritContext !== false
	);
	const store = (): Data => storeOf(scope) ?? new Data();
	try {
		push(options.context);
		out.push(open);
		component(out, options.props ?? ({} as P));
		out.push(close);
	} catch (error) {
		end(current);
		finish(current, true);
		throw error;
	}
	end(current);
	const result = (script?: Script): Rendered => {
		const content = out.collect();
		let head = (script?.html ?? '') + content.head + global.title();
		for (const { hash, code } of global.styles) head += `<style id="${hash}">${code}</style>`;
		return { head, body: content.body, hashes: { script: script?.hash ? [script.hash] : [] } };
	};
	if (!out.asynchronous && !store().needsSnapshot) {
		const rendered = result();
		finish(current, false);
		return {
			...rendered,
			then(fulfilled, rejected) {
				return Promise.resolve(rendered).then(fulfilled, rejected);
			}
		};
	}
	const settled = out
		.settle()
		.then(async () => result(await store().script(options.format ?? nativeFormat, options.csp)))
		.then(
			(rendered) => {
				finish(current, false);
				return rendered;
			},
			(error: unknown) => {
				finish(current, true);
				throw error;
			}
		);
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

export function bindProps(props: Props, values: Props): void {
	for (const key of Object.keys(values)) {
		const initial = props[key];
		const value = values[key];
		if (
			initial === undefined &&
			value !== undefined &&
			Object.getOwnPropertyDescriptor(props, key)?.set !== undefined
		)
			props[key] = value;
	}
}

export function snapshot<T>(value: T): T {
	return typeof value === 'object' && value !== null ? structuredClone(value) : value;
}
