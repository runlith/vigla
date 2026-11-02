import { DEV } from 'esm-env';
import { warn } from '../../shared/diagnostics.ts';
import { invalidArgs, type RawFactory, type SnippetArgs } from '../../shared/snippet.ts';
import { teardown } from '../reactivity/effects.ts';
import { claim, cursor, hydrating } from './hydration.ts';
import { parse } from './html.ts';

type Snippet<Values extends unknown[]> = (anchor: ChildNode, ...args: SnippetArgs<Values>) => void;

let nodeType: (() => unknown) | undefined;

export function snippetArgs(args: IArguments): void {
	nodeType ??= Object.getOwnPropertyDescriptor(Node.prototype, 'nodeType')!.get!;
	try {
		nodeType.call(args[0]);
	} catch {
		invalidArgs();
	}
	for (let index = 1; index < args.length; index++) {
		if (typeof args[index] !== 'function') invalidArgs();
	}
}

export function createRawSnippet<Values extends unknown[]>(
	factory: RawFactory<Values>
): Snippet<Values> {
	return (anchor, ...args) => {
		const snippet = factory(...args);
		let node: ChildNode;
		if (hydrating) {
			node = cursor;
			claim(node.nextSibling);
		} else {
			const content = parse(snippet.render().trim(), 0, anchor.ownerDocument as Document);
			const first = content.firstChild;
			if (DEV && (first?.nodeType !== 1 || first.nextSibling !== null)) {
				warn(
					'invalid_raw_snippet_render',
					'The `render` function passed to `createRawSnippet` should return HTML for a single element'
				);
			}
			if (first === null) return;
			node = first;
			anchor.before(node);
		}
		const cleanup = snippet.setup?.(node as Element);
		if (typeof cleanup === 'function') teardown(cleanup);
	};
}
