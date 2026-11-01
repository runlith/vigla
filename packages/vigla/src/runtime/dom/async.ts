import { asyncDerived, work } from '../reactivity/async.ts';
import { resumed, suspend } from '../reactivity/batch.ts';
import { fail } from '../reactivity/effects.ts';
import type { Effect, Source } from '../reactivity/graph.ts';
import { endReading, get, owner } from '../reactivity/tracking.ts';
import { derived, set, state } from '../reactivity/sources.ts';
import type { Exports } from './mount.ts';
import { CLOSE, OPEN, OPEN_ELSE } from '../../shared/markers.ts';
import { claim, COMMENT, cursor, hydrating, resumeHydration, setHydrating } from './hydration.ts';
import type { Render } from './template.ts';

function matchingClose(open: ChildNode): ChildNode {
	let depth = 0;
	for (let node = open.nextSibling; node !== null; node = node.nextSibling) {
		if (node.nodeType !== COMMENT) continue;
		const data = (node as Comment).data;
		if (data === CLOSE) {
			if (depth === 0) return node;
			depth--;
		} else if (data === OPEN || data === OPEN_ELSE || data.startsWith('[')) {
			depth++;
		}
	}
	return open;
}

interface Resume {
	readonly start: ChildNode | null;
	readonly end: ChildNode | null;
}

function park(node: ChildNode | null): Resume {
	if (!hydrating || node === null) return { start: null, end: null };
	const end = matchingClose(node);
	const start = node.nextSibling;
	claim(end);
	return { start, end };
}

function resume<T>(parked: Resume, fn: () => T): T {
	if (parked.start === null) return fn();
	const was = setHydrating(true);
	const saved = cursor;
	claim(parked.start);
	try {
		return fn();
	} finally {
		setHydrating(was);
		claim(saved);
	}
}

function settleWith(effect: Effect | null, error: unknown): void {
	if (effect === null || effect.destroyed) return;
	fail(effect, error);
}

interface Value {
	readonly value: unknown;
}

export function async(
	node: ChildNode | null,
	thunks: readonly (() => Value | PromiseLike<Value>)[],
	fn: (anchor: ChildNode | null, ...values: Source[]) => void
): void {
	const parked = park(node);
	const anchor = parked.end ?? node;
	const at = owner;
	const done = work();
	const restore = suspend();
	Promise.all(thunks.map((thunk) => asyncDerived(thunk))).then(
		(sources) => {
			if (at?.destroyed) {
				done();
				return;
			}
			restore();
			try {
				for (const source of sources) get(source);
				const values = sources.map((source) => derived(() => get(source).value));
				resume(parked, () => fn(anchor, ...values));
			} catch (error) {
				settleWith(at, error);
			} finally {
				resumed();
				done();
			}
		},
		(error: unknown) => {
			restore();
			try {
				settleWith(at, error);
			} finally {
				resumed();
				done();
			}
		}
	);
}

export async function save<T>(value: T | PromiseLike<T>): Promise<() => T> {
	const restore = suspend();
	endReading();
	const mode = hydrating;
	const resolved = await value;
	return () => {
		restore();
		const finish = resumeHydration(mode);
		queueMicrotask(() => {
			finish();
			resumed();
		});
		return resolved;
	};
}

export class ExportsCell {
	readonly #values = state<Exports>({});
	#pending: Map<string, unknown> | null = new Map();

	get(name: string): unknown {
		const values = get(this.#values);
		return this.#pending?.has(name) ? this.#pending.get(name) : values[name];
	}

	set(name: string, value: unknown): void {
		if (this.#pending !== null) this.#pending.set(name, value);
		else get(this.#values)[name] = value;
	}

	publish(values: Exports): void {
		for (const [name, value] of this.#pending ?? []) values[name] = value;
		this.#pending = null;
		set(this.#values, values);
	}
}

export function deferredExports(): ExportsCell {
	return new ExportsCell();
}

export function script(node: ChildNode, fn: () => Promise<Render>): void {
	const parked = park(hydrating ? cursor : node);
	if (parked.end !== null) claim(parked.end.nextSibling);
	let anchor = parked.end;
	if (anchor === null) {
		anchor = document.createTextNode('');
		node.before(anchor);
	}
	const at = owner;
	const done = work();
	const restore = suspend();
	let promise: Promise<Render>;
	try {
		promise = fn();
	} catch (error) {
		promise = Promise.reject(error);
	}
	resumed();
	promise.then(
		(render) => {
			if (at?.destroyed) {
				done();
				return;
			}
			restore();
			try {
				resume(parked, () => render(anchor));
			} catch (error) {
				settleWith(at, error);
			} finally {
				resumed();
				done();
			}
		},
		(error: unknown) => {
			restore();
			try {
				settleWith(at, error);
			} finally {
				resumed();
				done();
			}
		}
	);
}
