import { warn } from '../../shared/diagnostics.ts';
import { CLOSE, OPEN, OPEN_ELSE } from '../../shared/markers.ts';

export const COMMENT = 8;

export const TEXT = 3;

export const MISMATCH: unique symbol = Symbol('mismatch');

export let hydrating = false;

export let cursor: ChildNode = null as unknown as ChildNode;

export function setHydrating(on: boolean): boolean {
	const previous = hydrating;
	hydrating = on;
	return previous;
}

export let overwriting = false;

export function setOverwriting(on: boolean): boolean {
	const previous = overwriting;
	overwriting = on;
	return previous;
}

interface Continuation {
	readonly mode: boolean;
	previous: Continuation | null;
	next: Continuation | null;
}

let resumed: Continuation | null = null;
let ambient = false;

export function resumeHydration(mode: boolean): () => void {
	if (resumed === null) ambient = hydrating;
	const segment: Continuation = { mode, previous: resumed, next: null };
	if (resumed !== null) resumed.next = segment;
	resumed = segment;
	hydrating = mode;
	let active = true;
	return () => {
		if (!active) return;
		active = false;
		if (segment.previous !== null) segment.previous.next = segment.next;
		if (segment.next !== null) segment.next.previous = segment.previous;
		if (resumed === segment) resumed = segment.previous;
		hydrating = resumed?.mode ?? ambient;
	};
}

export function mismatch(): never {
	warn(
		'hydration_mismatch',
		'Hydration failed because the initial UI does not match what was rendered on the server'
	);
	throw MISMATCH;
}

export function claim(node: ChildNode | null): ChildNode {
	if (node === null) mismatch();
	cursor = node;
	return node;
}

export function advance(): ChildNode {
	return claim(cursor.nextSibling);
}

export function instruction(node: ChildNode): string {
	if (node.nodeType !== COMMENT) mismatch();
	return (node as Comment).data;
}

export function isClose(node: ChildNode): boolean {
	return node.nodeType === COMMENT && (node as Comment).data === CLOSE;
}

function opens(data: string): boolean {
	return (
		data === OPEN || data === OPEN_ELSE || (data[0] === '[' && !Number.isNaN(Number(data.slice(1))))
	);
}

export function skip(): ChildNode {
	let depth = 0;
	let node: ChildNode | null = cursor;
	for (;;) {
		if (node === null) mismatch();
		const next: ChildNode | null = node.nextSibling;
		if (node.nodeType === COMMENT) {
			const data = (node as Comment).data;
			if (data === CLOSE) {
				if (depth === 0) return claim(node);
				depth--;
			} else if (opens(data)) {
				depth++;
			}
		}
		node.remove();
		node = next;
	}
}
