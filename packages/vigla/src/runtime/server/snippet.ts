import { invalidArgs, type RawFactory, type SnippetArgs } from '../../shared/snippet.ts';
import { Output } from './render.ts';

type Snippet<Values extends unknown[]> = (out: Output, ...args: Values) => void;

export function snippetArgs(out: unknown): void {
	if (!(out instanceof Output)) invalidArgs();
}

export function createRawSnippet<Values extends unknown[]>(
	factory: RawFactory<Values>
): Snippet<Values> {
	return (out, ...values) => {
		const args = values.map((value) => () => value) as SnippetArgs<Values>;
		out.push(
			factory(...args)
				.render()
				.trim()
		);
	};
}
