import {
	BLOCK,
	BRANCH,
	CLEAN,
	DIRTY,
	ROOT,
	TEMPLATE,
	type Derived,
	type Effect,
	type Kind
} from './graph.ts';
import { schedule } from './batch.ts';
import { disconnect, owner, setOwner, track, untrack } from './tracking.ts';

let created = 0;

function create(kind: Kind, fn: () => void | (() => void), parent: Effect | null): Effect {
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
		order: ++created,
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

export function run(effect: Effect): void {
	const fn = effect.fn;
	if (fn === null) return;
	if (effect.kind === TEMPLATE) destroyChildren(effect);
	release(effect);
	const teardown = effect.teardown;
	effect.teardown = null;
	teardown?.();
	const previous = setOwner(effect);
	effect.running = true;
	try {
		const result =
			effect.kind === BLOCK || effect.kind === TEMPLATE
				? track(effect, fn)
				: untrack(() => {
						const value = fn();
						effect.status = CLEAN;
						return value;
					});
		if (typeof result === 'function') effect.teardown = result;
	} finally {
		effect.running = false;
		setOwner(previous);
	}
	if (effect.status === DIRTY && !effect.destroyed) schedule(effect);
}

function attach(kind: Kind, fn: () => void | (() => void)): Effect {
	const effect = create(kind, fn, owner);
	run(effect);
	return effect;
}

export function root(fn: () => void): Effect {
	const effect = create(ROOT, fn, null);
	run(effect);
	return effect;
}

export function branch(fn: () => void): Effect {
	return attach(BRANCH, fn);
}

export function block(fn: () => void): Effect {
	return attach(BLOCK, fn);
}

export function template(fn: () => void): Effect {
	return attach(TEMPLATE, fn);
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

function destroyChildren(effect: Effect): void {
	let child = effect.first;
	while (child !== null) {
		const next = child.next;
		destroy(child);
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
	teardown?.();
}
