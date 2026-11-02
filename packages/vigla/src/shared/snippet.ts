import { failure } from './diagnostics.ts';

export function invalidArgs(): never {
	throw failure(
		'invalid_snippet_arguments',
		'A snippet function was passed invalid arguments. Snippets should only be instantiated via `{@render ...}`'
	);
}

export function snippet<T extends (...args: never[]) => unknown>(fn: T): T {
	fn.toString = () => {
		throw failure(
			'snippet_without_render_tag',
			'Attempted to render a snippet without a `{@render}` block. This would cause the snippet code to be stringified instead of its content being rendered to the DOM. To fix this, change `{snippet}` to `{@render snippet()}`.'
		);
	};
	return fn;
}

export interface RawSnippet {
	render(): string;
	setup?(element: Element): void | (() => void);
}

export type SnippetArgs<Values extends unknown[]> = {
	[Key in keyof Values]: () => Values[Key];
};

export type RawFactory<Values extends unknown[]> = (...args: SnippetArgs<Values>) => RawSnippet;
