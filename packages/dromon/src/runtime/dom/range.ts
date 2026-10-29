import { branch, destroy } from '../reactivity/effects.ts';
import type { Effect } from '../reactivity/graph.ts';
import type { Render } from './template.ts';

export interface Built {
	readonly effect: Effect;
	readonly first: ChildNode | null;
	readonly last: ChildNode | null;
	fragment: DocumentFragment | null;
}

export function build(render: Render): Built {
	const fragment = document.createDocumentFragment();
	const anchor = document.createTextNode('');
	fragment.append(anchor);
	const effect = branch(() => render(anchor));
	anchor.remove();
	return { effect, first: fragment.firstChild, last: fragment.lastChild, fragment };
}

export function place(built: Built, before: ChildNode): void {
	if (built.fragment !== null) {
		before.before(built.fragment);
		built.fragment = null;
		return;
	}
	if (built.first === null || built.last?.nextSibling === before) return;
	let node: ChildNode = built.first;
	for (;;) {
		const next = node.nextSibling;
		before.before(node);
		if (node === built.last || next === null) return;
		node = next;
	}
}

export function discard(built: Built): void {
	if (built.fragment === null && built.first !== null) {
		let node: ChildNode | null = built.first;
		while (node !== null) {
			const next: ChildNode | null = node.nextSibling;
			node.remove();
			if (node === built.last) break;
			node = next;
		}
	}
	destroy(built.effect);
}

export function leave(built: Built): void {
	built.effect.inert = true;
}
