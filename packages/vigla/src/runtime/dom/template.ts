import { template } from '../reactivity/effects.ts';
import { derived } from '../reactivity/sources.ts';
import { get } from '../reactivity/tracking.ts';
import { advance, claim, cursor, hydrating, mismatch, setHydrating, TEXT } from './hydration.ts';

export type Render = (anchor: ChildNode) => void;

export const SINGLE = 1;

export const SVG = 2;

export const MATHML = 4;

export const SCRIPTS = 8;

function freshScript(source: Element): Element {
	const script = source.ownerDocument.createElementNS(source.namespaceURI, source.localName);
	for (const attribute of source.attributes) {
		if (attribute.namespaceURI === null) script.setAttribute(attribute.name, attribute.value);
		else script.setAttributeNS(attribute.namespaceURI, attribute.name, attribute.value);
	}
	script.textContent = source.textContent;
	return script;
}

function activateScripts(node: Node): Node {
	if (node.nodeType === 1 && (node as Element).localName === 'script')
		return freshScript(node as Element);
	for (const script of (node as ParentNode).querySelectorAll('script'))
		script.replaceWith(freshScript(script));
	return node;
}

function parse(html: string, flags: number): Node {
	const template = document.createElement('template');
	if ((flags & (SVG | MATHML)) === 0) {
		template.innerHTML = html;
		const content = template.content;
		return (flags & SINGLE) === 0 ? content : (content.firstChild as Node);
	}
	const wrapper = (flags & SVG) !== 0 ? 'svg' : 'math';
	template.innerHTML = `<${wrapper}>${html}</${wrapper}>`;
	const root = template.content.firstChild as Element;
	if ((flags & SINGLE) !== 0) return root.firstChild as Node;
	const fragment = document.createDocumentFragment();
	while (root.firstChild !== null) fragment.append(root.firstChild);
	return fragment;
}

const richOptions = new WeakMap<Document, boolean>();

function preservesOptions(document: Document): boolean {
	const cached = richOptions.get(document);
	if (cached !== undefined) return cached;
	const probe = document.createElement('select');
	probe.innerHTML = '<option><span></span></option>';
	const supported = probe.firstElementChild?.firstElementChild?.localName === 'span';
	richOptions.set(document, supported);
	return supported;
}

export function richSelect(element: Element, render: Render): void {
	const wasHydrating = hydrating;
	let completed = false;
	try {
		if (wasHydrating && !preservesOptions(element.ownerDocument)) {
			setHydrating(false);
			element.replaceChildren(element.ownerDocument.createComment(''));
		}
		const anchor = element.lastChild;
		if (anchor === null || anchor.nodeType !== 8) mismatch();
		if (hydrating) claim(element.firstChild);
		render(anchor);
		completed = true;
	} finally {
		if (wasHydrating) {
			if (hydrating && completed) reset(element);
			else {
				setHydrating(true);
				claim(element);
			}
		}
	}
}

export function fragment(html: string, flags = 0): () => Node {
	let parsed: Node | null = null;
	return () => {
		if (hydrating) return cursor;
		parsed ??= parse(html, flags);
		const node = document.importNode(parsed, true);
		return (flags & SCRIPTS) === 0 ? node : activateScripts(node);
	};
}

function textAt(node: ChildNode | null, after: ChildNode | null, parent: Node): ChildNode {
	if (node !== null && node.nodeType === TEXT) return claim(node);
	const text = document.createTextNode('');
	if (node !== null) node.before(text);
	else if (after !== null) after.after(text);
	else parent.appendChild(text);
	return claim(text);
}

export function first(fragment: Node, text = false): ChildNode {
	if (!hydrating) return fragment.firstChild as ChildNode;
	if (text && cursor.nodeType !== TEXT) return textAt(cursor, null, cursor.parentNode as Node);
	return cursor;
}

export function child(node: Node, text = false): ChildNode {
	const found = node.firstChild;
	if (!hydrating) return found as ChildNode;
	if (text || found === null) return textAt(found, null, node);
	return claim(found);
}

export function sibling(node: ChildNode, count = 1, text = false): ChildNode {
	let found: ChildNode | null = hydrating ? cursor : node;
	let previous: ChildNode | null = found;
	for (let step = 0; step < count; step++) {
		previous = found;
		found = (found as ChildNode).nextSibling;
	}
	if (!hydrating) return found as ChildNode;
	if (text) return textAt(found, previous, (previous as ChildNode).parentNode as Node);
	return claim(found);
}

export function next(count = 1): void {
	if (!hydrating) return;
	for (let step = 0; step < count; step++) advance();
}

export function reset(node: ChildNode): void {
	if (!hydrating) return;
	if (cursor.nextSibling !== null) mismatch();
	claim(node);
}

export function append(anchor: ChildNode, node: Node): void {
	if (hydrating) {
		advance();
		return;
	}
	anchor.before(node);
}

export function content(
	fn: (...values: unknown[]) => void,
	thunks?: readonly (() => unknown)[]
): void {
	if (thunks === undefined) {
		template(fn);
		return;
	}
	const sources = thunks.map((thunk) => derived(thunk));
	const values: unknown[] = new Array(sources.length);
	template(() => {
		for (let index = 0; index < sources.length; index++) values[index] = get(sources[index]!);
		fn(...values);
	});
}

const cached = Symbol('text');

interface Cached {
	[cached]?: string;
}

export function text(node: Text, value: unknown): void {
	const next = value == null ? '' : typeof value === 'string' ? value : `${value as string}`;
	const holder = node as Text & Cached;
	if ((holder[cached] ??= node.nodeValue ?? '') === next) return;
	holder[cached] = next;
	node.nodeValue = next;
}
