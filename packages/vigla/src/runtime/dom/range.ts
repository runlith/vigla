import { branch, destroy } from '../reactivity/effects.ts';
import type { Effect } from '../reactivity/graph.ts';
import { cursor, hydrating } from './hydration.ts';
import type { Render } from './template.ts';

export interface Built {
	readonly effect: Effect;
	readonly first: ChildNode;
	readonly last: ChildNode;
	fragment: DocumentFragment | null;
}

const positions = new WeakMap<Effect, ChildNode>();

export function position(effect: Effect | null): ChildNode | null {
	for (let current = effect; current !== null; current = current.parent) {
		const node = positions.get(current);
		if (node !== undefined) return node;
	}
	return null;
}

function adopt(render: Render, create: (fn: () => void) => Effect): Built {
	const start = cursor;
	const parent = start.parentNode as ParentNode;
	const before = start.previousSibling;
	const effect = create(() => render(start));
	const end = cursor;
	const first = before === null ? parent.firstChild : before.nextSibling;
	if (first === end) {
		const marker = document.createTextNode('');
		end.before(marker);
		positions.set(effect, marker);
		return { effect, first: marker, last: marker, fragment: null };
	}
	positions.set(effect, first as ChildNode);
	return {
		effect,
		first: first as ChildNode,
		last: end.previousSibling as ChildNode,
		fragment: null
	};
}

export function build(render: Render, create: (fn: () => void) => Effect = branch): Built {
	if (hydrating) return adopt(render, create);
	const fragment = document.createDocumentFragment();
	const first = document.createTextNode('');
	const anchor = document.createTextNode('');
	fragment.append(first, anchor);
	const effect = create(() => render(anchor));
	anchor.remove();
	positions.set(effect, first);
	return { effect, first, last: fragment.lastChild as ChildNode, fragment };
}

export function place(built: Built, before: ChildNode): void {
	if (built.fragment !== null) {
		before.before(built.fragment);
		built.fragment = null;
		return;
	}
	if (built.last.nextSibling === before) return;
	let node: ChildNode = built.first;
	for (;;) {
		const next = node.nextSibling;
		before.before(node);
		if (node === built.last || next === null) return;
		node = next;
	}
}

export function stash(built: Built): void {
	if (built.fragment !== null) return;
	const fragment = document.createDocumentFragment();
	let node: ChildNode | null = built.first;
	while (node !== null) {
		const next: ChildNode | null = node.nextSibling;
		fragment.append(node);
		if (node === built.last) break;
		node = next;
	}
	built.fragment = fragment;
}

export function discard(built: Built): void {
	if (built.fragment === null) {
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
