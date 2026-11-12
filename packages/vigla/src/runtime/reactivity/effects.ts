import {
	ASYNC,
	BLOCK,
	BRANCH,
	CLEAN,
	DESTROYED,
	DIRTY,
	EAGER,
	EFFECT,
	FORKED,
	INERT,
	PRESERVED,
	ROOT,
	RUNNING,
	SCOPE,
	TEMPLATE,
	UNITS,
	isDerived,
	isDestroyed,
	type Boundary,
	type Derived,
	type Effect,
	type Kind,
	type Reaction,
	type Source
} from './graph.ts';
import { failure, unhandled } from '../../shared/diagnostics.ts';
import {
	abort,
	abortLifetime,
	evaluationSignal,
	lifetime,
	restoreSignal,
	takeSignal
} from './abort.ts';
import {
	alias,
	collect,
	conceal,
	orphaned,
	pending,
	processed,
	revisit,
	schedule,
	type Batch
} from './batch.ts';
import {
	admit,
	capture,
	closing,
	createdBy,
	draftOf,
	drafting,
	draftedIn,
	draftsOf,
	enlist,
	inDrafts,
	take,
	type Draft
} from './drafts.ts';
import { frontOf, setFront } from './front.ts';
import { handlerOf } from './handlers.ts';
import { orphan, teardownOrphan } from './errors.ts';
import { ownLeaving } from './outgoing.ts';
import { presently, retire } from './past.ts';
import { link, unlink } from './siblings.ts';
import { endUnits } from './units.ts';
import {
	deriving,
	evaluation,
	marked,
	owner,
	present,
	reading,
	resuming,
	running,
	setOwner,
	takeHidden,
	track,
	withoutReaction,
	view
} from './tracking.ts';
import { observe, unsubscribe } from './edges.ts';

let created = 0;

export interface Aside {
	readonly effects: Effect[] | null;
	readonly frozen: Effect[] | null;
	readonly signal: AbortController | undefined;
}

function register(reaction: Reaction, draft: Draft): void {
	const batch = draft.batch;
	if (!enlist(reaction, draft)) return;
	(batch.settles ??= []).push(() => close(batch));
	batch.commits.push({ apply: () => adopt(batch) });
}

function drop(reaction: Reaction, draft: Draft): void {
	take(reaction, draft);
	const parent = isDerived(reaction) ? reaction.owner : (reaction as Effect);
	if (parent !== null) destroyChildren(parent, false, (child) => draft.children.has(child));
	for (const child of draft.children) destroy(child);
	const created = draft.created;
	if (created !== null) {
		const holder = reaction as Effect;
		const owned = holder.owned?.filter((derived) => !created.has(derived)) ?? [];
		holder.owned = owned.length === 0 ? null : owned;
		for (const derived of created) disconnect(derived);
	}
	if (draft.teardown !== null) dispose(reaction as Effect, draft.teardown);
}

function dropAll(reaction: Reaction): void {
	for (const draft of [...draftsOf(reaction)]) drop(reaction, draft);
}

function close(batch: Batch): void {
	const cohort = alias(batch);
	for (const reaction of closing(batch) ?? []) {
		if (!cohort.discarded && isDerived(reaction)) {
			install(reaction, cohort);
			continue;
		}
		const draft = draftOf(reaction, batch);
		if (draft !== undefined) drop(reaction, draft);
	}
}

function install(derived: Derived, cohort: Batch): void {
	const found = draftsOf(derived).filter((draft) => alias(draft.batch) === cohort);
	const latest = found.pop();
	if (latest === undefined) return;
	for (const draft of found) drop(derived, draft);
	take(derived, latest);
	const replaced = derived.effects;
	const effects = [...latest.children].filter((effect) => !isDestroyed(effect));
	derived.effects = effects.length === 0 ? null : effects;
	derived.frozen = null;
	restoreSignal(derived, latest.signal);
	for (const effect of replaced ?? []) destroy(effect);
	if (derived.reactions === null) freeze(derived);
}

function adopt(batch: Batch): void {
	for (const reaction of draftedIn(batch) ?? []) {
		if (isDerived(reaction)) continue;
		const effect = reaction as Effect;
		const draft = draftOf(effect, batch);
		if (draft === undefined || isDestroyed(effect)) continue;
		if (!draft.speculative || effect.batch === batch.order) promote(effect, draft);
	}
}

function promote(effect: Effect, draft: Draft): void {
	take(effect, draft);
	restoreSignal(effect, draft.signal);
	const found = [draft, ...draftsOf(effect)];
	destroyChildren(effect, effect.kind === BLOCK, (child) => !inDrafts(found, child));
	const owned = effect.owned;
	effect.owned = null;
	for (const derived of owned ?? []) {
		if (createdBy(found, derived)) (effect.owned ??= []).push(derived);
		else disconnect(derived);
	}
	const teardown = effect.teardown;
	effect.teardown = draft.teardown;
	if (teardown !== null) dispose(effect, teardown);
}

export function setAside(derived: Derived): Aside {
	const aside = { effects: derived.effects, frozen: derived.frozen, signal: takeSignal(derived) };
	derived.effects = derived.frozen = null;
	return aside;
}

export function discardAside(derived: Derived, aside: Aside): void {
	for (const effect of aside.effects ?? []) destroy(effect);
	if (drafting !== 0) dropAll(derived);
}

export function restoreAside(derived: Derived, aside: Aside, batch: Batch): void {
	if (batch.done && !alias(batch).discarded) return discardAside(derived, aside);
	const children = derived.effects ?? [];
	const signal = takeSignal(derived);
	derived.effects = aside.effects;
	derived.frozen = aside.frozen;
	restoreSignal(derived, aside.signal);
	const previous = draftOf(derived, batch);
	if (batch.done) for (const child of children) destroy(child);
	else if (children.length > 0) {
		const draft: Draft = {
			batch,
			speculative: batch.fork,
			children: new Set(),
			created: null,
			teardown: null,
			signal
		};
		for (const child of children) admit(draft, child);
		register(derived, draft);
	}
	if (previous !== undefined) drop(derived, previous);
}

function ownEffect(effect: Effect): Derived | null {
	const derived = deriving();
	if (derived === null || effect.kind === ROOT || effect.parent !== derived.owner) return null;
	if (!ownLeaving(effect)) (derived.effects ??= []).push(effect);
	return derived;
}

export function destroyEffects(derived: Derived): void {
	if (drafting !== 0) dropAll(derived);
	const effects = derived.effects;
	if (effects === null) return;
	derived.effects = derived.frozen = null;
	for (const effect of effects) destroy(effect);
}

const ended = new WeakMap<Derived, readonly Source[]>();

export function endedInputs(derived: Derived): readonly Source[] | undefined {
	return ended.get(derived);
}

function disconnect(derived: Derived): void {
	const deps = derived.deps;
	destroyEffects(derived);
	unsubscribe(derived);
	if (derived.lapses && deps !== null && derived.owner !== null && isDestroyed(derived.owner))
		ended.set(derived, deps);
	derived.status = DIRTY;
	marked();
}

export function hide(effect: Effect): void {
	if ((effect.flags & (DESTROYED | INERT)) !== 0) return;
	effect.flags |= INERT;
	conceal(1);
}

export function show(effect: Effect): void {
	if ((effect.flags & INERT) === 0) return;
	effect.flags &= ~INERT;
	conceal(-1);
}

function create(kind: Kind, fn: (() => void | (() => void)) | null, parent: Effect | null): Effect {
	const effect: Effect = {
		kind,
		status: DIRTY,
		flags: 0,
		batch: 0,
		deps: null,
		rv: 0,
		fn,
		teardown: null,
		parent,
		first: null,
		last: null,
		prev: null,
		next: null,
		owned: null,
		boundary: parent === null ? null : parent.boundary,
		context: parent === null ? null : parent.context,
		order: ++created,
		slots: null,
		captured: null
	};
	if (parent !== null) link(effect, parent);
	const claimer = ownEffect(effect);
	if (drafting !== 0 && parent !== null) capture(parent, effect, claimer);
	return effect;
}

function release(effect: Effect): void {
	for (const derived of effect.owned ?? []) disconnect(derived);
	effect.owned = null;
}

export function fail(effect: Effect | null, error: unknown): void {
	for (let at = effect; at !== null; at = at.parent) {
		const handler = handlerOf(at);
		if (handler !== null) {
			try {
				handler.failed(error);
				return;
			} catch (thrown) {
				error = thrown;
			}
		}
		const boundary = at.boundary;
		if (boundary !== null && boundary !== (at.parent?.boundary ?? null)) {
			boundary.failed(error);
			return;
		}
	}
	escape(effect, error);
}

let creating = 0;
let scheduling = 0;

export function enterScheduler(): number {
	scheduling++;
	const outer = creating;
	creating = 0;
	return outer;
}

export function leaveScheduler(outer: number): void {
	scheduling--;
	creating = outer;
}

export function escape(effect: Effect | null, error: unknown): void {
	if (effect === null || creating > 0 || scheduling === 0) throw error;
	unhandled(frontOf(effect), error);
}

export function overflow(effect: Effect, error: unknown): void {
	const outer = enterScheduler();
	try {
		fail(effect, error);
	} finally {
		leaveScheduler(outer);
	}
}

function dispose(effect: Effect, teardown: () => void): void {
	try {
		retire(effect, teardown);
	} catch (error) {
		fail(effect, error);
	}
}

function begin(effect: Effect, batch: Batch): Draft {
	if (!batch.fork) dropAll(effect);
	else {
		const previous = draftOf(effect, batch);
		if (previous !== undefined) drop(effect, previous);
	}
	const draft: Draft = {
		batch,
		speculative: batch.fork,
		children: new Set(),
		created: null,
		teardown: null,
		signal: undefined
	};
	register(effect, draft);
	return draft;
}

export function run(effect: Effect, first = false): void {
	const fn = effect.fn;
	if (fn === null) return;
	const tracked = effect.kind !== ROOT && effect.kind !== BRANCH;
	const batch = view?.batch ?? processed();
	const draft =
		!first && tracked && batch !== null && (batch.fork || (effect.flags & ASYNC) !== 0)
			? begin(effect, batch)
			: null;
	let signal: AbortController | undefined;
	if (draft === null) {
		destroyChildren(effect, effect.kind === BLOCK);
		release(effect);
		const teardown = effect.teardown;
		if (teardown !== null) {
			effect.teardown = null;
			dispose(effect, teardown);
		}
		if (drafting !== 0) dropAll(effect);
	} else signal = takeSignal(effect);
	const previous = setOwner(effect);
	effect.flags |= RUNNING;
	let result: unknown;
	let failed = false;
	let caught: unknown;
	try {
		result = tracked
			? track(effect, fn)
			: withoutReaction(() => {
					const value = fn();
					effect.status = CLEAN;
					return value;
				});
	} catch (error) {
		failed = true;
		caught = error;
	} finally {
		effect.flags &= ~RUNNING;
		setOwner(previous);
		if (draft !== null) {
			draft.signal = takeSignal(effect);
			restoreSignal(effect, signal);
		}
	}
	const hidden = tracked ? takeHidden() : null;
	effect.batch = batch?.order ?? 0;
	if (batch?.fork === true) effect.flags |= FORKED;
	else effect.flags &= ~FORKED;
	if (failed) {
		effect.status = CLEAN;
		fail(effect, caught);
		return;
	}
	if (typeof result === 'function') {
		const returned = result as () => void;
		if (draft !== null) draft.teardown = returned;
		else effect.teardown = effect.teardown === null ? returned : both(effect.teardown, returned);
	}
	if (hidden !== null || pending.length > 0) revisit(effect, hidden);
	if (effect.status !== CLEAN && !isDestroyed(effect)) schedule(effect);
}

export function start(effect: Effect): Effect {
	creating++;
	try {
		run(effect, true);
	} catch (error) {
		destroy(effect);
		throw error;
	} finally {
		creating--;
	}
	return effect;
}

function spent(effect: Effect): boolean {
	const deps = effect.deps;
	return (
		effect.status === CLEAN &&
		(effect.flags & (DESTROYED | PRESERVED | UNITS)) === 0 &&
		(deps === null || deps.length === 0) &&
		effect.first === null &&
		effect.teardown === null &&
		effect.owned === null
	);
}

function attach(kind: Kind, fn: () => void | (() => void)): Effect {
	const effect = start(create(kind, fn, owner));
	if (kind === TEMPLATE && spent(effect)) {
		unlink(effect);
		effect.fn = null;
		effect.flags |= DESTROYED;
	}
	return effect;
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
		const front = frontOf(owner);
		if (front !== null) setFront(effect, front);
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

export function eager(fn: () => void | (() => void)): Effect {
	return present(() => attach(EAGER, fn));
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

function both(first: () => void, second: () => void): () => void {
	return () => {
		try {
			first();
		} finally {
			second();
		}
	};
}

export function atEnd(fn: () => void): void {
	const holder = owner;
	if (holder === null || (holder.kind !== BRANCH && holder.kind !== ROOT)) {
		teardown(fn);
		return;
	}
	const previous = holder.teardown;
	holder.teardown = previous === null ? fn : both(previous, fn);
}

export function destroyed(fn: () => void): Effect {
	if (owner === null) teardownOrphan();
	return teardown(() => presently(fn));
}

export function tracking(): boolean {
	return reading();
}

export function getAbortSignal(): AbortSignal {
	if (evaluation() === null && owner !== null) return lifetime(owner);
	return getReactionSignal();
}

export function getReactionSignal(): AbortSignal {
	const reaction = evaluation();
	if (reaction === null) {
		throw failure(
			'get_abort_signal_outside_reaction',
			'`getAbortSignal()` can only be called inside an effect or derived'
		);
	}
	const run = resuming();
	const ended = run !== null && (run.ended || isDestroyed(run.reaction as Effect));
	const release = ended ? immediately : teardown;
	return evaluationSignal(reaction, release, reaction === running());
}

function immediately(stop: () => void): void {
	stop();
}

type Among = ((child: Effect) => boolean) | null;

function doomed(child: Effect, keepBranches: boolean, among: Among): boolean {
	return (
		(child.flags & DESTROYED) === 0 &&
		((child.flags & SCOPE) !== 0 || !keepBranches || child.kind !== BRANCH) &&
		(among === null || among(child))
	);
}

function destroyChildren(effect: Effect, keepBranches = false, among: Among = null): void {
	for (;;) {
		let end = effect.last;
		while (end !== null && !doomed(end, keepBranches, among)) end = end.prev;
		if (end === null) return;
		if ((end.flags & SCOPE) !== 0) {
			destroy(end);
			continue;
		}
		let start = end;
		while (start.prev !== null && (start.prev.flags & SCOPE) === 0) start = start.prev;
		for (let child: Effect | null = start; child !== null;) {
			const next: Effect | null = child === end ? null : child.next;
			if (doomed(child, keepBranches, among)) destroy(child);
			if (next === null || isDestroyed(next)) break;
			child = next;
		}
	}
}

const detaching = new WeakMap<Effect, () => void>();

export function detachment(effect: Effect): (() => void) | null {
	return detaching.get(effect) ?? null;
}

export function detach(effect: Effect, fn: (() => void) | null): void {
	if (fn === null) detaching.delete(effect);
	else detaching.set(effect, fn);
}

export function destroy(effect: Effect): void {
	if ((effect.flags & DESTROYED) !== 0) return;
	effect.flags |= DESTROYED;
	const detached = detaching.get(effect);
	if (detached !== undefined) {
		detaching.delete(effect);
		dispose(effect, detached);
	}
	abortLifetime(effect);
	destroyChildren(effect);
	release(effect);
	unsubscribe(effect);
	const teardown = effect.teardown;
	effect.teardown = null;
	effect.fn = null;
	unlink(effect);
	if ((effect.flags & INERT) !== 0) {
		effect.flags &= ~INERT;
		conceal(-1);
	}
	if (teardown !== null) dispose(effect, teardown);
	if (drafting !== 0) dropAll(effect);
	if (effect.parent === null) orphaned(effect);
	endUnits(effect);
}

function holding(effect: Effect): boolean {
	return (
		(effect.flags & (DESTROYED | RUNNING)) === 0 &&
		effect.fn !== null &&
		(effect.kind === EFFECT || effect.kind === TEMPLATE) &&
		(effect.teardown !== null || effect.first !== null)
	);
}

export function freeze(derived: Derived): void {
	if (drafting !== 0) dropAll(derived);
	const effects = derived.effects;
	if (effects === null) return;
	if (abort(derived)) {
		derived.status = DIRTY;
		marked();
	}
	let frozen = derived.frozen;
	for (const effect of effects) {
		if (!holding(effect)) continue;
		destroyChildren(effect);
		release(effect);
		unsubscribe(effect);
		effect.status = CLEAN;
		const teardown = effect.teardown;
		effect.teardown = null;
		if (teardown !== null) dispose(effect, teardown);
		(frozen ??= []).push(effect);
	}
	derived.frozen = frozen;
}

export function thaw(derived: Derived): void {
	const frozen = derived.frozen;
	if (frozen === null) return;
	derived.frozen = null;
	for (const effect of frozen) {
		if (isDestroyed(effect)) continue;
		effect.status = DIRTY;
		schedule(effect);
	}
}

observe({ observed: thaw, unobserved: freeze });
