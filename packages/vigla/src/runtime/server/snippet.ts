import type { RawFactory, SnippetArgs } from '../../shared/snippet.ts';
import type { Output } from './render.ts';

type Snippet<Values extends unknown[]> = (out: Output, ...args: Values) => void;

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
