import { DEV } from 'esm-env';
import { fail } from './effects.ts';
import { referencesSelf } from './errors.ts';
import { inside } from './batch.ts';
import { changed } from './reads.ts';
import {
	DIRTY,
	equal,
	isDerived,
	retainsFailures,
	stamp,
	type Derived,
	type Source
} from './graph.ts';
import { updated } from './trace.ts';
import { leavingCount, selecting, withoutLeaving } from './leaving.ts';
import {
	affected,
	destroyEffects,
	marked,
	setOwner,
	stale,
	takeHidden,
	track,
	view
} from './tracking.ts';
import { unsubscribe } from './edges.ts';

const evaluating: Derived[] = [];

export function enter(derived: Derived): void {
	if (evaluating.includes(derived)) referencesSelf();
	evaluating.push(derived);
}

export function leave(): void {
	evaluating.pop();
}

export function refresh(derived: Derived): void {
	if (derived.deps !== null && !stale(derived)) return;
	if (view !== null && affected(derived, view)) return;
	destroyEffects(derived);
	if (DEV) enter(derived);
	const previous = setOwner(derived.owner);
	try {
		let value: unknown;
		try {
			value =
				selecting && leavingCount !== 0
					? withoutLeaving(() => track(derived, derived.fn))
					: track(derived, derived.fn);
		} catch (error) {
			takeHidden();
			derived.computed = false;
			derived.wv = stamp();
			const holder = derived.owner;
			if (holder === null || retainsFailures(derived)) derived.failure = { error };
			if (holder === null) return;
			derived.v = undefined as typeof derived.v;
			if (holder.destroyed) return;
			const status = derived.status;
			derived.status = DIRTY;
			fail(holder, error);
			derived.status = status;
			return;
		}
		if (derived.failure !== null) derived.failure = null;
		const hidden = takeHidden();
		if (hidden !== null && view !== null) {
			derived.status = DIRTY;
			view.values.set(derived, value);
			view.reached.set(derived, hidden);
			view.checked.set(derived, true);
			return;
		}
		if (!derived.computed || !equal(derived, derived.v, value)) {
			derived.v = value;
			derived.wv = stamp();
			derived.computed = true;
			if (DEV) updated(derived);
		}
	} finally {
		setOwner(previous);
		if (DEV) leave();
	}
}

export function forget(source: Source): void {
	const given = view;
	if (given === null) return;
	given.values.delete(source);
	given.hidden.delete(source);
	const staged = given.batch.fork ? given.batch.after : null;
	const cleared = staged === null ? null : new Set<Source>();
	const clear = (from: Source): void => {
		for (const reaction of from.reactions ?? []) {
			if (!isDerived(reaction)) continue;
			if (cleared === null) {
				if (!given.checked.has(reaction)) continue;
			} else {
				if (cleared.has(reaction)) continue;
				cleared.add(reaction);
			}
			given.checked.delete(reaction);
			given.values.delete(reaction);
			given.reached.delete(reaction);
			if (staged?.has(reaction)) {
				const reads = given.batch.origins?.get(reaction)?.reads;
				if (reads !== undefined && !inside(given.batch, () => changed(reads, reaction)))
					given.values.set(reaction, staged.get(reaction));
				else {
					staged.delete(reaction);
					given.batch.origins?.delete(reaction);
				}
			}
			clear(reaction);
		}
	};
	clear(source);
}

export function disconnect(derived: Derived): void {
	destroyEffects(derived);
	unsubscribe(derived);
	derived.status = DIRTY;
	marked();
}
