import { failure } from '../../shared/diagnostics.ts';
import { close, open } from '../../shared/markers.ts';
import { begin, end, push } from './context.ts';

export type Props = Record<string, unknown>;

class Global {
	#uid = 1;
	readonly prefix: string;

	constructor(prefix: string) {
		this.prefix = prefix;
	}

	uid(): string {
		return `${this.prefix}s${this.#uid++}`;
	}
}

export class Output {
	readonly #parts: string[] = [];
	readonly global: Global;

	constructor(global: Global) {
		this.global = global;
	}

	push(html: string): void {
		this.#parts.push(html);
	}

	toString(): string {
		return this.#parts.join('');
	}
}

export type Component<P extends Props = Props> = (out: Output, props: P) => void;

export interface RenderOptions<P extends Props> {
	readonly props?: P;
	readonly idPrefix?: string;
	readonly context?: Map<unknown, unknown>;
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
	const out = new Output(new Global(prefix ? `${prefix}-` : ''));
	const saved = begin();
	try {
		push(options.context);
		out.push(open);
		component(out, options.props ?? ({} as P));
		out.push(close);
	} finally {
		end(saved);
	}
	const rendered: Rendered = { head: '', body: out.toString(), hashes: { script: [] } };
	return {
		...rendered,
		then(fulfilled, rejected) {
			return Promise.resolve(rendered).then(fulfilled, rejected);
		}
	};
}

export function propsId(out: Output): string {
	const id = out.global.uid();
	out.push(`<!--$${id}-->`);
	return id;
}

export function derived<T>(fn: () => T): () => T {
	let computed = false;
	let value = undefined as T;
	return () => {
		if (!computed) {
			value = fn();
			computed = true;
		}
		return value;
	};
}

export function iterate<T>(
	collection: Iterable<T> | ArrayLike<T> | null | undefined
): ArrayLike<T> {
	if (collection == null) return [];
	return (collection as ArrayLike<T>).length !== undefined
		? (collection as ArrayLike<T>)
		: Array.from(collection as Iterable<T>);
}

export function snapshot<T>(value: T): T {
	return typeof value === 'object' && value !== null ? structuredClone(value) : value;
}
