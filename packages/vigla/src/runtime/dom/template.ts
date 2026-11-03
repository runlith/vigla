import { format, htmlPolicy } from '../../shared/format.ts';
import { namespaces } from '../../shared/html.ts';
import { template } from '../reactivity/effects.ts';
import { derived } from '../reactivity/sources.ts';
import { get } from '../reactivity/reads.ts';
import {
	advance,
	claim,
	cursor,
	hydrating,
	mismatch,
	setHydrating,
	setOverwriting,
	TEXT
} from './hydration.ts';
import { trustedAttribute, trustedHtml, trustedScript } from './trusted.ts';

export type Render = (anchor: ChildNode) => void;

export const SINGLE = 1;

export const SVG = 2;

export const MATHML = 4;

export const SCRIPTS = 8;

function setTrusted(
	element: Element,
	name: string,
	namespace: string | null,
	value: string,
	policy: string
): void {
	const given = trustedAttribute(element, name, namespace, value, policy);
	if (namespace === null) element.setAttribute(name, given);
	else element.setAttributeNS(namespace, name, given);
}

function freshScript(source: Element, policy: string): Element {
	const script = source.ownerDocument.createElementNS(source.namespaceURI, source.localName);
	for (const attribute of source.attributes)
		setTrusted(script, attribute.name, attribute.namespaceURI, attribute.value, policy);
	script.textContent = trustedScript(source.textContent ?? '', policy);
	return script;
}

function activateScripts(node: Node, policy: string): Node {
	if (node.nodeType === 1 && (node as Element).localName === 'script')
		return freshScript(node as Element, policy);
	for (const script of (node as ParentNode).querySelectorAll('script'))
		script.replaceWith(freshScript(script, policy));
	return node;
}

function parse(html: string, flags: number, policy: string): Node {
	const template = document.createElement('template');
	if ((flags & (SVG | MATHML)) === 0) {
		template.innerHTML = trustedHtml(html, policy);
		const content = template.content;
		return (flags & SINGLE) === 0 ? content : (content.firstChild as Node);
	}
	const wrapper = (flags & SVG) !== 0 ? 'svg' : 'math';
	template.innerHTML = trustedHtml(`<${wrapper}>${html}</${wrapper}>`, policy);
	const root = template.content.firstChild as Element;
	if ((flags & SINGLE) !== 0) return root.firstChild as Node;
	const fragment = document.createDocumentFragment();
	while (root.firstChild !== null) fragment.append(root.firstChild);
	return fragment;
}

const richOptions = new WeakMap<Document, boolean>();

function preservesOptions(document: Document, policy: string): boolean {
	const cached = richOptions.get(document);
	if (cached !== undefined) return cached;
	const probe = document.createElement('select');
	probe.innerHTML = trustedHtml('<option><span></span></option>', policy);
	const supported = probe.firstElementChild?.firstElementChild?.localName === 'span';
	richOptions.set(document, supported);
	return supported;
}

export function richSelect(element: Element, render: Render, policy = htmlPolicy(format)): void {
	const wasHydrating = hydrating;
	let completed = false;
	try {
		if (wasHydrating && !preservesOptions(element.ownerDocument, policy)) {
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

export type Structure =
	| string
	| null
	| readonly [string, (Readonly<Record<string, string>> | null)?, ...Structure[]];

const TEXT_POINT = 'text-point';

const ANNOTATION = 'annotation';

type Context = string | null;

const XLINK = 'http://www.w3.org/1999/xlink';

const XML = 'http://www.w3.org/XML/1998/namespace';

const XMLNS = 'http://www.w3.org/2000/xmlns/';

const foreignAttributes: Readonly<Record<string, string>> = {
	'xlink:actuate': XLINK,
	'xlink:arcrole': XLINK,
	'xlink:href': XLINK,
	'xlink:role': XLINK,
	'xlink:show': XLINK,
	'xlink:title': XLINK,
	'xlink:type': XLINK,
	'xml:lang': XML,
	'xml:space': XML,
	xmlns: XMLNS,
	'xmlns:xlink': XMLNS
};

const textPoints = new Set(['mi', 'mo', 'mn', 'ms', 'mtext']);

function spaceOf(name: string, context: Context): string | null {
	if (context === null || context === TEXT_POINT) {
		if (context === TEXT_POINT && (name === 'mglyph' || name === 'malignmark')) {
			return namespaces.mathml;
		}
		return name === 'svg' ? namespaces.svg : name === 'math' ? namespaces.mathml : null;
	}
	if (context === ANNOTATION) return name === 'svg' ? namespaces.svg : namespaces.mathml;
	return context;
}

function within(name: string, space: string | null, encoding: string | undefined): Context {
	if (space === namespaces.svg) {
		return name === 'foreignObject' || name === 'desc' || name === 'title' ? null : space;
	}
	if (space !== namespaces.mathml) return null;
	if (textPoints.has(name)) return TEXT_POINT;
	if (name !== 'annotation-xml') return space;
	const kind = encoding?.toLowerCase();
	return kind === 'text/html' || kind === 'application/xhtml+xml' ? null : ANNOTATION;
}

function construct(
	structure: readonly Structure[],
	context: Context,
	parent: Node,
	policy: string
): void {
	for (const item of structure) {
		if (typeof item === 'string') {
			parent.appendChild(document.createTextNode(item));
			continue;
		}
		if (item === null || item[0].startsWith('// ')) {
			parent.appendChild(document.createComment(item === null ? '' : item[0].slice(3)));
			continue;
		}
		const [name, attributes, ...children] = item;
		const space = spaceOf(name, context);
		const is = attributes?.is;
		const element =
			space === null
				? document.createElement(name, is === undefined ? undefined : { is })
				: document.createElementNS(space, name);
		for (const [key, value] of Object.entries(attributes ?? {})) {
			const foreign = space === null ? undefined : foreignAttributes[key];
			setTrusted(element, key, foreign ?? null, value, policy);
		}
		const inner =
			space === null && name === 'template' ? (element as HTMLTemplateElement).content : element;
		construct(children, within(name, space, attributes?.encoding), inner, policy);
		parent.appendChild(element);
	}
}

function build(structure: readonly Structure[], flags: number, policy: string): Node {
	const context =
		(flags & SVG) !== 0 ? namespaces.svg : (flags & MATHML) !== 0 ? namespaces.mathml : null;
	const fragment = document.createDocumentFragment();
	construct(structure, context, fragment, policy);
	return (flags & SINGLE) === 0 ? fragment : (fragment.firstChild as Node);
}

function cloned(master: () => Node, flags: number, policy: string): () => Node {
	let made: Node | null = null;
	return () => {
		if (hydrating) return cursor;
		made ??= master();
		const node = document.importNode(made, true);
		return (flags & SCRIPTS) === 0 ? node : activateScripts(node, policy);
	};
}

export function fragment(html: string, flags = 0, policy = htmlPolicy(format)): () => Node {
	return cloned(() => parse(html, flags, policy), flags, policy);
}

export function tree(
	structure: readonly Structure[],
	flags = 0,
	policy = htmlPolicy(format)
): () => Node {
	return cloned(() => build(structure, flags, policy), flags, policy);
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

export function awaitedContent(
	fn: (...values: unknown[]) => void,
	thunks?: readonly (() => unknown)[]
): void {
	const was = setOverwriting(true);
	try {
		content(fn, thunks);
	} finally {
		setOverwriting(was);
	}
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
