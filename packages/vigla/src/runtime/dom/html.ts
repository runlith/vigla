import { DEV } from 'esm-env';
import { warn } from '../../shared/diagnostics.ts';
import { hash } from '../../shared/hash.ts';
import { template } from '../reactivity/effects.ts';
import { claim, COMMENT, hydrating, instruction, mismatch } from './hydration.ts';

export const CONTROLLED = 1;
export const HTML_SVG = 2;
export const HTML_MATHML = 4;
export const UNCHECKED = 8;

const FRAGMENT = 11;

function closing(open: ChildNode): ChildNode {
	let node = open.nextSibling;
	while (node !== null && (node.nodeType !== COMMENT || (node as Comment).data !== '')) {
		node = node.nextSibling;
	}
	if (node === null) mismatch();
	return node;
}

export function parse(html: string, flags = 0, doc: Document = document): ParentNode {
	if ((flags & HTML_SVG) !== 0 || (flags & HTML_MATHML) !== 0) {
		const svg = (flags & HTML_SVG) !== 0;
		const wrapper = doc.createElementNS(
			svg ? 'http://www.w3.org/2000/svg' : 'http://www.w3.org/1998/Math/MathML',
			svg ? 'svg' : 'math'
		);
		wrapper.innerHTML = html;
		return wrapper;
	}
	const wrapper = doc.createElement('template');
	wrapper.innerHTML = html;
	return wrapper.content;
}

function changed(server: string, value: string): void {
	if (server === '' || server === hash(value)) return;
	warn(
		'hydration_html_changed',
		'The value of an `{@html ...}` block changed between server and client renders. The client value will be ignored in favour of the server value'
	);
}

export function html(node: ChildNode, get: () => unknown, flags = 0): void {
	const controlled = (flags & CONTROLLED) !== 0;
	let anchor = node;
	let first: ChildNode | null = null;
	let last: ChildNode | null = null;
	let value: string | null = null;
	let server: string | null = null;
	if (hydrating) {
		const open = controlled ? (node.firstChild ?? mismatch()) : node;
		server = instruction(open);
		const close = closing(open);
		if (open.nextSibling !== close) {
			first = open.nextSibling;
			last = close.previousSibling;
		}
		anchor = close;
		claim(controlled ? node : close);
	}
	template(() => {
		const next = String(get() ?? '');
		if (server !== null) {
			if (DEV && (flags & UNCHECKED) === 0) changed(server, next);
			server = null;
			value = next;
			return;
		}
		if (next === value) return;
		value = next;
		if (controlled) {
			(node as Element).innerHTML = next;
			return;
		}
		while (first !== null) {
			const following: ChildNode | null = first === last ? null : first.nextSibling;
			first.remove();
			first = following;
		}
		last = null;
		if (next === '') return;
		const content = parse(next, flags);
		first = content.firstChild as ChildNode | null;
		last = content.lastChild as ChildNode | null;
		if (content.nodeType === FRAGMENT) anchor.before(content as DocumentFragment);
		else while (content.firstChild !== null) anchor.before(content.firstChild);
	});
}
