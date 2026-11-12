import { DEV } from 'esm-env';
import { processed } from './batch.ts';
import {
	destroyEffects,
	discardAside,
	endedInputs,
	fail,
	restoreAside,
	setAside,
	type Aside
} from './effects.ts';
import { inertDerived, referencesSelf } from './errors.ts';
import {
	ASYNC,
	BLOCK,
	CLEAN,
	DIRTY,
	FORKED,
	MAYBE,
	equal,
	isDerived,
	isDestroyed,
	now,
	retainsFailures,
	stamp,
	type Derived,
	type Effect,
	type Reaction,
	type Source
} from './graph.ts';
import { NONE } from './history.ts';
import { lose } from './loss.ts';
import {
	departures,
	leavingCount,
	outgoing,
	selecting,
	withoutLeaving,
	type Departures
} from './outgoing.ts';
import { tearingDown } from './past.ts';
import { updated } from './provenance.ts';
import {
	capture,
	compute,
	depend,
	lost,
	note,
	observedReads,
	past,
	reading,
	setOwner,
	takeHidden,
	track,
	validate,
	view,
	viewedReads,
	type Past,
	type View
} from './tracking.ts';
import { inside } from './views.ts';

const evaluating: Derived[] = [];

function enter(derived: Derived): void {
	if (evaluating.includes(derived)) referencesSelf();
	evaluating.push(derived);
}

function leave(): void {
	evaluating.pop();
}

export function get<T>(source: Source<T>): T {
	if (DEV && lost !== null && !reading()) lose(source);
	const value = read(source);
	capture(source, value);
	return value;
}

function read<T>(source: Source<T>): T {
	depend(source);
	if (past !== null) return recall(source, past) as T;
	if (selecting && (leavingCount !== 0 || outgoing !== null)) {
		const found = departures as Departures;
		const given = outgoing ?? (isDerived(source) ? found.view(source) : null);
		if (given !== null) return found.read(source, given) as T;
		if (isDerived(source))
			return withoutLeaving(() => (view === null ? settled(source) : through(source, view))) as T;
	}
	if (view !== null) return through(source, view) as T;
	if (isDerived(source)) return settled(source) as T;
	return source.v;
}

function settled(derived: Derived): unknown {
	if (derived.status !== CLEAN) refresh(derived);
	const failure = derived.failure;
	if (failure !== null) throw failure.error;
	return derived.v;
}

function affected(derived: Derived, given: View): boolean {
	const known = given.checked.get(derived);
	if (known !== undefined) return known;
	given.checked.set(derived, false);
	let found = derived.deps === null;
	for (const dep of derived.deps ?? []) {
		if (given.values.has(dep) || (isDerived(dep) && affected(dep, given))) {
			found = true;
			break;
		}
	}
	given.checked.set(derived, found);
	return found;
}

function through(source: Source, given: View): unknown {
	if (given.values.has(source)) {
		const hidden = given.hidden.get(source);
		if (hidden !== undefined) note([hidden]);
		else if (isDerived(source)) {
			const reached = given.reached.get(source);
			if (reached !== undefined) note(reached);
		}
		return given.values.get(source);
	}
	if (!isDerived(source)) return source.v;
	if (inert(source)) return source.v;
	if (!affected(source, given)) {
		refresh(source);
		if (!given.values.has(source)) {
			if (source.failure !== null) throw source.failure.error;
			return source.v;
		}
		const reached = given.reached.get(source);
		if (reached !== undefined) note(reached);
		return given.values.get(source);
	}
	const aside = setAside(source);
	if (DEV) enter(source);
	let value: unknown;
	try {
		value = compute(source, given);
	} catch (error) {
		restoreAside(source, aside, given.batch);
		throw error;
	} finally {
		if (DEV) leave();
	}
	if ((source.deps as Source[]).length === 0) {
		discardAside(source, aside);
		given.checked.set(source, false);
		source.v = value;
		source.wv = stamp();
		source.rv = now();
		source.computed = true;
		source.status = CLEAN;
		return value;
	}
	restoreAside(source, aside, given.batch);
	given.values.set(source, value);
	return value;
}

function dated(derived: Derived, given: Past, loose: boolean): boolean {
	if (derived.deps === null) return true;
	for (const dep of derived.deps) {
		if (given.written?.has(dep)) continue;
		if (loose && given.home.retired!.has(dep)) continue;
		if (given.before(dep) !== NONE || (given.later !== null && given.later(dep) !== NONE))
			return true;
		if (isDerived(dep) && dated(dep, given, loose)) return true;
	}
	return false;
}

function recall(source: Source, given: Past): unknown {
	const retired = given.home.retired;
	const loose = retired !== null && !given.reader.deps?.includes(source);
	if ((given.written === null || !given.written.has(source)) && !(loose && retired.has(source))) {
		const before = given.before(source);
		if (before !== NONE) return before;
		if (given.later !== null) {
			const later = given.later(source);
			if (later !== NONE) return later;
		}
	}
	if (!isDerived(source)) return view === null ? source.v : through(source, view);
	if (given.derived !== null && given.derived.has(source)) return given.derived.get(source);
	if (!dated(source, given, loose)) {
		if (view !== null) return through(source, view);
		return settled(source);
	}
	const value = source.fn();
	(given.derived ??= new Map()).set(source, value);
	return value;
}

export function refresh(derived: Derived): void {
	if (derived.deps !== null && !stale(derived)) return;
	if (view !== null && affected(derived, view)) return;
	recompute(derived);
}

let lapsed: Set<Derived> | null = null;

function inert(derived: Derived): boolean {
	if (!derived.lapses) return false;
	const holder = derived.owner;
	if (holder === null || !isDestroyed(holder) || !derived.computed || tearingDown()) return false;
	const outer = lapsed;
	if (outer?.has(derived)) return true;
	const checked = (lapsed = outer ?? new Set());
	checked.add(derived);
	try {
		if (moved(derived)) inertDerived();
	} finally {
		lapsed = outer;
	}
	return true;
}

function moved(derived: Derived): boolean {
	const inputs = endedInputs(derived);
	if (inputs === undefined) return true;
	for (const input of inputs) {
		if (isDerived(input) && input.status !== CLEAN) refresh(input);
		if (input.wv > derived.rv) return true;
	}
	return false;
}

function recompute(derived: Derived): void {
	if (inert(derived)) return;
	const given = view;
	let aside: Aside | null = null;
	if (given === null) destroyEffects(derived);
	else aside = setAside(derived);
	let local = false;
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
			if (isDestroyed(holder)) return;
			const status = derived.status;
			derived.status = DIRTY;
			fail(holder, error);
			derived.status = status;
			return;
		}
		if (derived.failure !== null) derived.failure = null;
		const hidden = takeHidden();
		if (hidden !== null && given !== null) {
			local = true;
			derived.status = DIRTY;
			given.values.set(derived, value);
			given.reached.set(derived, hidden);
			given.checked.set(derived, true);
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
		if (aside !== null) {
			if (local && given !== null) restoreAside(derived, aside, given.batch);
			else discardAside(derived, aside);
		}
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

export function changed(reads: ReadonlyMap<Source, unknown>, target: Reaction): boolean {
	return validate(target, () => {
		for (const [source, value] of reads) if (!equal(source, value, get(source))) return true;
		return false;
	});
}

export function stale(target: Reaction, recheck = false): boolean {
	if (recheck && target.deps === null) return true;
	if (
		recheck &&
		((target.deps as Source[]).length > 0 ||
			(!isDerived(target) && ((target as Effect).flags & ASYNC) !== 0))
	) {
		const effect = target as Effect;
		const batch = view?.batch ?? processed();
		const own = batch?.reads?.get(effect);
		if (
			own === undefined &&
			effect.kind === BLOCK &&
			(effect.flags & (ASYNC | FORKED)) !== ASYNC &&
			effect.batch !== 0 &&
			effect.batch !== batch?.order
		)
			return true;
		const reads = own ?? observedReads(target);
		if (reads !== undefined) {
			const dirty = changed(reads, target);
			if (!dirty) target.status = CLEAN;
			return dirty;
		}
		target.status = MAYBE;
	}
	const status = target.status;
	if (status === DIRTY) return true;
	if (status === MAYBE) {
		const effect = target as Effect;
		const batch = view?.batch ?? processed();
		if (
			effect.kind === BLOCK &&
			(effect.flags & (ASYNC | FORKED)) === FORKED &&
			effect.batch !== batch?.order &&
			!batch?.reads?.has(effect)
		)
			return true;
		const reads = viewedReads(target);
		if (reads !== undefined) {
			const dirty = changed(reads, target);
			if (!dirty) target.status = CLEAN;
			return dirty;
		}
		const deps = target.deps;
		if (deps !== null) {
			for (let index = 0; index < deps.length; index++) {
				const dep = deps[index] as Source;
				if (isDerived(dep)) {
					if (view !== null) {
						if (affected(dep, view)) return true;
						refresh(dep);
						if (view.values.has(dep)) return true;
					} else if (dep.status !== CLEAN && (dep.deps === null || stale(dep))) recompute(dep);
				}
				if (dep.wv > target.rv) return true;
			}
		}
		target.status = CLEAN;
	}
	return false;
}
