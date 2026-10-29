import { close, open } from '../../shared/markers.ts';

export type Props = Record<string, unknown>;

export class Output {
	readonly #parts: string[] = [];

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
	const out = new Output();
	out.push(open);
	component(out, options.props ?? ({} as P));
	out.push(close);
	const rendered: Rendered = { head: '', body: out.toString(), hashes: { script: [] } };
	return {
		...rendered,
		then(fulfilled, rejected) {
			return Promise.resolve(rendered).then(fulfilled, rejected);
		}
	};
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

export function iterate<T>(collection: Iterable<T> | ArrayLike<T> | null | undefined): T[] {
	return collection == null ? [] : Array.from(collection);
}
