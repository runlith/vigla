import {
	BLOCK,
	BRANCH,
	CLEAN,
	DIRTY,
	EFFECT,
	ROOT,
	TEMPLATE,
	type Boundary,
	type Derived,
	type Effect,
	type Kind
} from './graph.ts';
import { collect, orphaned, retire, revisit, schedule } from './batch.ts';
import { orphan } from './errors.ts';
import {
	disconnect,
	owner,
	reading,
	setOwner,
	takeHidden,
	track,
	untrack,
	view
} from './tracking.ts';

let created = 0;

export const offscreen = new Set<Effect>();

export function hide(effect: Effect): void {
	if (effect.destroyed || offscreen.has(effect)) return;
	offscreen.add(effect);
	effect.inert = true;
}

export function show(effect: Effect): void {
	if (!offscreen.delete(effect)) return;
	effect.inert = false;
}

function create(kind: Kind, fn: (() => void | (() => void)) | null, parent: Effect | null): Effect {
	const effect: Effect = {
		kind,
		fn,
		teardown: null,
		parent,
		first: null,
		last: null,
		prev: null,
		next: null,
		owned: null,
		units: null,
		boundary: parent === null ? null : parent.boundary,
		context: parent === null ? null : parent.context,
		order: ++created,
		forked: 0,
		status: DIRTY,
		deps: null,
		rv: 0,
		running: false,
		destroyed: false,
		inert: false,
		pending: false
	};
	if (parent !== null) {
		effect.prev = parent.last;
		if (parent.last === null) parent.first = effect;
		else parent.last.next = effect;
		parent.last = effect;
	}
	return effect;
}

export function own(derived: Derived): void {
	if (owner !== null) (owner.owned ??= []).push(derived);
}

function release(effect: Effect): void {
	for (const derived of effect.owned ?? []) disconnect(derived);
	effect.owned = null;
}

export function fail(effect: Effect, error: unknown): void {
	const boundary = effect.boundary;
	if (boundary === null) throw error;
	boundary.failed(error);
}

export function run(effect: Effect): void {
	const fn = effect.fn;
	if (fn === null) return;
	destroyChildren(effect, effect.kind === BLOCK);
	release(effect);
	const teardown = effect.teardown;
	if (teardown !== null) {
		effect.teardown = null;
		retire(teardown);
	}
	const tracked = effect.kind !== ROOT && effect.kind !== BRANCH;
	const previous = setOwner(effect);
	effect.running = true;
	let result: unknown;
	let failed = false;
	let caught: unknown;
	try {
		result = tracked
			? track(effect, fn)
			: untrack(() => {
					const value = fn();
					effect.status = CLEAN;
					return value;
				});
	} catch (error) {
		failed = true;
		caught = error;
	} finally {
		effect.running = false;
		setOwner(previous);
	}
	const hidden = tracked ? takeHidden() : null;
	effect.forked = view !== null && view.batch.fork ? view.batch.order : 0;
	if (failed) {
		fail(effect, caught);
		return;
	}
	if (typeof result === 'function') effect.teardown = result as () => void;
	if (hidden !== null) revisit(effect, hidden);
	if (effect.status === DIRTY && !effect.destroyed) schedule(effect);
}

function start(effect: Effect): Effect {
	try {
		run(effect);
	} catch (error) {
		destroy(effect);
		throw error;
	}
	return effect;
}

function attach(kind: Kind, fn: () => void | (() => void)): Effect {
	return start(create(kind, fn, owner));
}

export function root(fn: () => void): Effect {
	return start(create(ROOT, fn, null));
}

export function detached(fn: (() => void | (() => void)) | null, parent: Effect | null): Effect {
	const effect = create(ROOT, fn, parent);
	if (fn === null) effect.status = CLEAN;
	return start(effect);
}

export function effectRoot(fn: () => void | (() => void)): () => void {
	const effect = create(ROOT, fn, null);
	if (owner !== null) {
		effect.context = owner.context;
		effect.boundary = owner.boundary;
	}
	start(effect);
	return () => destroy(effect);
}

export function branch(fn: () => void, boundary?: Boundary): Effect {
	const effect = create(BRANCH, fn, owner);
	if (boundary !== undefined) effect.boundary = boundary;
	return start(effect);
}

export function block(fn: () => void): Effect {
	return attach(BLOCK, fn);
}

export function template(fn: () => void | (() => void)): Effect {
	return attach(TEMPLATE, fn);
}

export function pre(fn: () => void | (() => void)): Effect {
	if (owner === null) orphan('$effect.pre');
	return attach(TEMPLATE, fn);
}

export function effect(fn: () => void | (() => void)): Effect {
	if (owner === null) orphan('$effect');
	const created = create(EFFECT, fn, owner);
	collect(created);
	return created;
}

export function teardown(fn: () => void): Effect {
	const created = create(EFFECT, null, owner);
	created.status = CLEAN;
	created.teardown = fn;
	return created;
}

export function tracking(): boolean {
	return reading();
}

function unlink(effect: Effect): void {
	const parent = effect.parent;
	if (parent === null) return;
	if (effect.prev === null) parent.first = effect.next;
	else effect.prev.next = effect.next;
	if (effect.next === null) parent.last = effect.prev;
	else effect.next.prev = effect.prev;
	effect.prev = effect.next = null;
}

function destroyChildren(effect: Effect, keepBranches = false): void {
	let child = effect.first;
	while (child !== null) {
		const next = child.next;
		if (!keepBranches || child.kind !== BRANCH) destroy(child);
		child = next;
	}
}

export function destroy(effect: Effect): void {
	if (effect.destroyed) return;
	effect.destroyed = true;
	destroyChildren(effect);
	release(effect);
	for (const dep of effect.deps ?? []) dep.reactions?.delete(effect);
	effect.deps = null;
	const teardown = effect.teardown;
	effect.teardown = null;
	effect.fn = null;
	unlink(effect);
	if (offscreen.delete(effect)) effect.inert = false;
	if (teardown !== null) retire(teardown);
	if (effect.parent === null) orphaned(effect);
	const units = effect.units;
	if (units !== null) {
		effect.units = null;
		for (const settle of units) settle();
	}
}
