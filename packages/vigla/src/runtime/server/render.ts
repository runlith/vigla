import { failure } from '../../shared/diagnostics.ts';
import { close, open } from '../../shared/markers.ts';
import { begin, end, push } from './context.ts';

export type Props = Record<string, unknown>;

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

	track(promise: Promise<unknown>): void {
		promise.catch(() => {});
		this.pending.push(promise);
	}

	async settle(): Promise<void> {
		while (this.pending.length > 0) await Promise.all(this.pending.splice(0));
	}
}

export class Output {
	readonly #parts: (string | Output)[] = [];
	readonly global: Global;

	constructor(global: Global) {
		this.global = global;
	}

	push(html: string): void {
		this.#parts.push(html);
	}

	child(fn: (out: Output) => void | Promise<void>): void {
		const inner = new Output(this.global);
		this.#parts.push(inner);
		const result = fn(inner);
		if (result instanceof Promise) this.global.track(result);
	}

	mark(): number {
		return this.#parts.length;
	}

	truncate(mark: number): void {
		this.#parts.length = mark;
	}

	toString(): string {
		let html = '';
		for (const part of this.#parts) html += typeof part === 'string' ? part : part.toString();
		return html;
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
	const result = (): Rendered => ({ head: '', body: out.toString(), hashes: { script: [] } });
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
