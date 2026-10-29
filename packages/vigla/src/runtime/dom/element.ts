import { namespaces } from '../../shared/html.ts';
import { block } from '../reactivity/effects.ts';
import { Branches } from './branches.ts';
import { advance, claim, cursor, hydrating, mismatch, setHydrating } from './hydration.ts';
import type { Render } from './template.ts';

const ELEMENT = 1;

export type Content = (element: Element, anchor: ChildNode | null) => void;

function namespaceOf(
	tag: string,
	namespace: (() => string | null | undefined) | null,
	parent: string
): string {
	if (namespace !== null) return namespace() || namespaces.html;
	if (parent === 'svg' || tag === 'svg') return namespaces.svg;
	if (parent === 'mathml' || tag === 'math') return namespaces.mathml;
	return namespaces.html;
}

const rawText = new Set(['TEXTAREA', 'SCRIPT', 'STYLE', 'TITLE']);

function children(element: Element, content: Content): void {
	if (!hydrating) {
		content(element, element.appendChild(document.createTextNode('')));
		return;
	}
	if (rawText.has(element.nodeName)) {
		const end = element.appendChild(document.createComment(''));
		claim(element.firstChild as ChildNode);
		try {
			content(element, element.firstChild);
		} finally {
			end.remove();
		}
		return;
	}
	const first = element.firstChild;
	if (first === null) {
		setHydrating(false);
		try {
			content(element, element.appendChild(document.createTextNode('')));
		} finally {
			setHydrating(true);
		}
		return;
	}
	claim(first);
	content(element, first);
}

function rendering(tag: string, namespace: string, content: Content | null): Render {
	return (anchor) => {
		let element: Element;
		if (hydrating) {
			if (cursor.nodeType !== ELEMENT) mismatch();
			element = cursor as Element;
		} else {
			element = document.createElementNS(namespace, tag);
		}
		if (content !== null) children(element, content);
		if (hydrating) claim(element.nextSibling);
		else anchor.before(element);
	};
}

export function element(
	node: ChildNode,
	tag: () => unknown,
	parent: string,
	content: Content | null,
	namespace: (() => string | null | undefined) | null = null
): void {
	if (hydrating) advance();
	const branches = new Branches<string | null>(node);
	let first = true;
	block(() => {
		const next = (tag() as string | null | undefined) || null;
		const render =
			next === null ? null : rendering(next, namespaceOf(next, namespace, parent), content);
		if (!first) {
			branches.show(next, () => render);
			return;
		}
		first = false;
		branches.start(next, render);
	});
}
