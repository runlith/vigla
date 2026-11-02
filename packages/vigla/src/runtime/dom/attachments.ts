import { alias, atCommit, atDiscard, atMerge, processed, type Batch } from '../reactivity/batch.ts';
import { block, branch, destroy, effect, template } from '../reactivity/effects.ts';
import type { Effect } from '../reactivity/graph.ts';
import { owner, setOwner, untrack } from '../reactivity/tracking.ts';

export const ATTACHMENT = '@attach';

export type Attachment<E extends Element = Element> = (element: E) => void | (() => void);

export function attachment(): symbol {
	return Symbol(ATTACHMENT);
}

export function attach(element: Element, get: () => unknown): Effect {
	let current: unknown;
	let shown: Effect | null = null;
	let parent: Effect | null = null;
	let stages: Map<Batch, unknown> | null = null;
	const publish = (next: unknown): void => {
		if (parent === null || parent.destroyed || next === current) return;
		current = next;
		if (shown !== null) destroy(shown);
		shown = null;
		if (typeof next !== 'function') return;
		const previous = setOwner(parent);
		try {
			shown = branch(() => effect(() => (next as Attachment)(element)));
		} finally {
			setOwner(previous);
		}
	};
	return block(() => {
		parent = owner;
		const next = get();
		const batch = processed();
		if (batch === null) {
			publish(next);
			return;
		}
		const pending = (stages ??= new Map());
		const known = pending.has(batch);
		pending.set(batch, next);
		if (known) return;
		atCommit({
			apply() {
				const target = alias(batch);
				if (!pending.has(target)) return;
				const selected = pending.get(target);
				pending.delete(target);
				publish(selected);
			}
		});
		atDiscard(() => pending.delete(alias(batch)));
		atMerge((from, into) => {
			if (!pending.has(from)) return;
			const selected = pending.get(from);
			pending.delete(from);
			if (from.order > into.order || !pending.has(into)) pending.set(into, selected);
		});
	});
}

const attached = Symbol('attached');

type Spread = Record<string | symbol, unknown> & { [attached]?: Map<symbol, Effect> };

export function spreadAttachments(element: Element, current: Spread, next: Spread): void {
	let effects = current[attached];
	for (const key of Object.getOwnPropertySymbols(next)) {
		if (key.description !== ATTACHMENT) continue;
		const fn = next[key];
		if (effects?.has(key) && current[key] === fn) continue;
		effects ??= current[attached] = new Map();
		const previous = effects.get(key);
		if (previous !== undefined) destroy(previous);
		const parent = owner?.parent ?? null;
		const saved = setOwner(parent);
		try {
			effects.set(
				key,
				untrack(() => attach(element, () => fn))
			);
		} finally {
			setOwner(saved);
		}
		current[key] = fn;
	}
	if (effects === undefined) return;
	for (const [key, effect] of effects) {
		if (key in next) continue;
		destroy(effect);
		effects.delete(key);
		delete current[key];
	}
}

interface Payload<P> {
	readonly update?: (value: P) => void;
	readonly destroy?: () => void;
}

type Action<P> = (element: Element, value?: P) => Payload<P> | void | null | undefined;

function deepRead(value: unknown, seen: Set<object>): void {
	if (typeof value !== 'object' || value === null || value instanceof EventTarget) return;
	if (seen.has(value)) return;
	seen.add(value);
	for (const key of Object.keys(value)) deepRead((value as Record<string, unknown>)[key], seen);
}

function differs(previous: unknown, next: unknown): boolean {
	if (previous !== previous) return next === next;
	return (
		previous !== next ||
		(previous !== null && typeof previous === 'object') ||
		typeof previous === 'function'
	);
}

export function action<P>(element: Element, run: Action<P>, get?: () => P): void {
	effect(() => {
		const payload = untrack(() => run(element, get?.())) ?? {};
		if (get !== undefined && payload.update !== undefined) {
			const update = payload.update;
			let previous: unknown = {};
			let started = false;
			template(() => {
				const value = get();
				deepRead(value, new Set());
				if (started && differs(previous, value)) {
					previous = value;
					update.call(payload, value);
				}
			});
			started = true;
		}
		if (payload.destroy !== undefined) return () => payload.destroy?.();
	});
}
