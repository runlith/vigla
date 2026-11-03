import * as core from 'vigla/server';
import { failure } from 'vigla/internal/server';
import { format } from '../shared/format.ts';

export * from 'vigla/server';

export interface Rendered extends core.Rendered {
	readonly html: string;
}

export type Rendering = Rendered & PromiseLike<Rendered>;

class Settled implements Rendered {
	readonly head: string;
	readonly body: string;
	readonly hashes: core.Hashes;

	constructor(value: core.Rendered) {
		this.head = value.head;
		this.body = value.body;
		this.hashes = value.hashes;
	}

	get html(): string {
		throw failure(
			'html_deprecated',
			'The `html` property of server render results has been deprecated. Use `body` instead.'
		);
	}
}

class Result implements Rendering {
	readonly #result: core.Rendering;

	constructor(result: core.Rendering) {
		this.#result = result;
	}

	get head(): string {
		return this.#result.head;
	}

	get body(): string {
		return this.#result.body;
	}

	get html(): string {
		return this.#result.body;
	}

	get hashes(): core.Hashes {
		return this.#result.hashes;
	}

	then<A = Rendered, B = never>(
		fulfilled?: ((value: Rendered) => A | PromiseLike<A>) | null,
		rejected?: ((reason: unknown) => B | PromiseLike<B>) | null
	): PromiseLike<A | B> {
		return Promise.resolve(this.#result)
			.then((value): Rendered => new Settled(value))
			.then(fulfilled, rejected);
	}
}

export function render<P extends core.Props>(
	component: core.Component<P>,
	options: core.RenderOptions<P> = {}
): Rendering {
	return new Result(
		core.render(component, {
			...options,
			format: options.format ?? format,
			inheritContext: options.inheritContext ?? false
		})
	);
}
