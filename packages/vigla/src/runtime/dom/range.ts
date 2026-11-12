import { branch, destroy } from '../reactivity/effects.ts';
import type { Effect } from '../reactivity/graph.ts';
import { isCustomTag } from '../../shared/html.ts';
import { cursor, hydrating } from './hydration.ts';
import type { Render } from './template.ts';

export interface Built {
	readonly effect: Effect;
	readonly first: ChildNode;
	readonly last: ChildNode;
	fragment: DocumentFragment | null;
}

const positions = new WeakMap<Effect, ChildNode>();

let slotting = false;

const offscreen = new WeakMap<ParentNode, boolean>();

function slots(at: ChildNode | null): boolean {
	if (at === null) return false;
	const parent = at.parentNode;
	if (parent === null) return slotting;
	if (parent.nodeType !== 1) return offscreen.get(parent) ?? slotting;
	const element = parent as Element;
	return isCustomTag(element.localName) || element.shadowRoot !== null;
}

export function opener(at: ChildNode | null): ChildNode {
	return slots(at) ? document.createComment('') : document.createTextNode('');
}

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
		const marker = opener(end);
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

export function build(
	render: Render,
	create: (fn: () => void) => Effect = branch,
	at: ChildNode | null = null
): Built {
	if (hydrating) return adopt(render, create);
	const fragment = document.createDocumentFragment();
	const slotted = slots(at);
	const first = slotted ? document.createComment('') : document.createTextNode('');
	const anchor = document.createTextNode('');
	fragment.append(first, anchor);
	offscreen.set(fragment, slotted);
	const outer = slotting;
	slotting = slotted;
	let effect: Effect;
	try {
		effect = create(() => render(anchor));
	} finally {
		slotting = outer;
	}
	anchor.remove();
	positions.set(effect, first);
	return { effect, first, last: fragment.lastChild as ChildNode, fragment };
}

const stages: (DocumentFragment | undefined)[] = [];

let depth = 0;

function stage(): DocumentFragment {
	let found = stages[depth];
	if (found === undefined) {
		found = document.createDocumentFragment();
		found.append(document.createTextNode(''));
		stages[depth] = found;
	}
	return found;
}

export function buildLoose(
	render: Render,
	create: (fn: () => void) => Effect = branch,
	at: ChildNode | null = null
): Built {
	if (hydrating) return adopt(render, create);
	const slotted = slots(at);
	const fragment = stage();
	const anchor = fragment.lastChild as ChildNode;
	const outer = slotting;
	slotting = slotted;
	depth++;
	let effect: Effect;
	try {
		effect = create(() => render(anchor));
	} catch (error) {
		while (fragment.firstChild !== anchor) (fragment.firstChild as ChildNode).remove();
		throw error;
	} finally {
		depth--;
		slotting = outer;
	}
	const first = fragment.firstChild as ChildNode;
	if (first !== anchor && first.nextSibling === anchor && first.nodeType === 1) {
		first.remove();
		positions.set(effect, first);
		return { effect, first, last: first, fragment: null };
	}
	stages[depth] = undefined;
	anchor.remove();
	const marker = slotted ? document.createComment('') : document.createTextNode('');
	fragment.prepend(marker);
	offscreen.set(fragment, slotted);
	positions.set(effect, marker);
	return { effect, first: marker, last: fragment.lastChild as ChildNode, fragment };
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
	offscreen.set(fragment, slots(built.first));
	let node: ChildNode | null = built.first;
	while (node !== null) {
		const next: ChildNode | null = node.nextSibling;
		fragment.append(node);
		if (node === built.last) break;
		node = next;
	}
	built.fragment = fragment;
}

export function remove(built: Built): void {
	if (built.fragment !== null) return;
	let node: ChildNode | null = built.first;
	while (node !== null) {
		const next: ChildNode | null = node.nextSibling;
		node.remove();
		if (node === built.last) break;
		node = next;
	}
}

export function discard(built: Built): void {
	remove(built);
	destroy(built.effect);
}
