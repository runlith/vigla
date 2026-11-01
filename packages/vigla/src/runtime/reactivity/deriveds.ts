import { DEV } from 'esm-env';
import { fail } from './effects.ts';
import { DIRTY, equal, stamp, type Derived } from './graph.ts';
import { updated } from './trace.ts';
import {
	affected,
	destroyEffects,
	marked,
	setOwner,
	stale,
	takeHidden,
	track,
	unsubscribe,
	view
} from './tracking.ts';

export function refresh(derived: Derived): void {
	if (derived.deps !== null && !stale(derived)) return;
	if (view !== null && affected(derived, view)) return;
	destroyEffects(derived);
	const previous = setOwner(derived.owner);
	try {
		let value: unknown;
		try {
			value = track(derived, derived.fn);
		} catch (error) {
			takeHidden();
			derived.computed = false;
			derived.wv = stamp();
			const holder = derived.owner;
			if (holder === null) {
				derived.failure = { error };
				return;
			}
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
	}
}

export function disconnect(derived: Derived): void {
	destroyEffects(derived);
	for (const dep of derived.deps ?? []) unsubscribe(dep, derived);
	derived.deps = null;
	derived.status = DIRTY;
	marked();
}
