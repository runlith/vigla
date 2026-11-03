import { DEV } from 'esm-env';
import {
	enqueue,
	handOver,
	holds,
	joins,
	members,
	onFlush,
	open,
	opening,
	overlook,
	overlooked,
	pending,
	processing,
	receiver,
	receiving,
	request,
	setOpen,
	setProcessing,
	type Batch,
	type Change
} from './batch.ts';
import { drafting, forkOf } from './drafts.ts';
import { forget, refresh } from './reads.ts';
import { queueEager, runEager } from './eager.ts';
import { enterScheduler, leaveScheduler, overflow, run } from './effects.ts';
import { depthExceeded } from './errors.ts';
import {
	BLOCK,
	CLEAN,
	DERIVED,
	DIRTY,
	EAGER,
	EFFECT,
	MAYBE,
	TEMPLATE,
	asynchronous,
	equal,
	stamp,
	type Derived,
	type Effect,
	type Source,
	type Status
} from './graph.ts';
import { abandon, absorb, finish, hold, reconcile, rescue } from './held.ts';
import { beforeOf, record } from './history.ts';
import { remember } from './leaving.ts';
import { written } from './past.ts';
import { applied, computed, loopWrite, reportLoop, resetLoop, updated } from './provenance.ts';
import { due, eager, settle } from './settle.ts';
import { drain } from './tasks.ts';
import { conceal, marked, present, readDuringRun, setView, view } from './tracking.ts';
import { quieted } from './units.ts';
import { others, viewOf } from './views.ts';

const limit = 1000;

let visits = 0;
let seen: Set<Source> | null = null;
let scheduling: Batch | null = null;
let staging: Batch | null = null;

function mark(source: Source, status: Status, all: boolean, forked: number): void {
	const reactions = source.reactions;
	if (reactions === null) return;
	const length = reactions.length;
	if (seen !== null) {
		if (seen.has(source)) return;
		seen.add(source);
	} else if ((visits += length) > 10_000) seen = new Set([source]);
	for (let index = 0; index < length; index++) {
		const reaction = reactions[index] as Derived | Effect;
		const previous = reaction.status;
		if (reaction.kind === DERIVED) {
			if (!staging?.fork && previous < status) reaction.status = status;
			mark(reaction, MAYBE, all, forked);
			continue;
		}
		const effect = reaction;
		if (effect.kind === EAGER) {
			if (staging !== null) continue;
			if (previous < status) effect.status = status;
			queueEager(effect);
			continue;
		}
		if (forked !== 0 && previous === CLEAN && effect.batch === forked) continue;
		if (previous < status) effect.status = status;
		if (eager !== null && previous !== DIRTY && effect.kind === BLOCK && !asynchronous.has(effect))
			eager.add(effect);
		if (all || previous === CLEAN) enqueue((scheduling ??= receiving()), effect);
	}
}

function dirty(source: Source, forked = 0): void {
	if (source.reactions === null) return;
	marked();
	visits = 0;
	const all = pending.length > 0;
	if (all) members(receiving());
	mark(source, DIRTY, all, forked);
	seen = null;
	const batch = scheduling;
	scheduling = null;
	if (batch !== null && batch !== processing && batch.started) request();
}

export function stage<T>(batch: Batch, source: Source<T>, value: T, origin = batch.order): T {
	const after = (batch.after ??= new Map());
	const selected = view !== null && view.batch === batch && view.values.has(source);
	const shown = after.has(source)
		? after.get(source)
		: selected
			? view!.values.get(source)
			: source.v;
	if (equal(source, shown as T, value) && (!batch.fork || source.kind !== DERIVED)) return value;
	record(batch, source, batch.fork ? source.v : shown, false);
	after.set(source, value);
	(batch.origins ??= new Map()).set(source, { order: origin, version: stamp() });
	if (DEV) {
		if (batch.fork) updated(source, value, batch);
		else computed(source, value, batch);
	}
	if (view !== null && view.batch === batch) {
		forget(source);
		view.values.set(source, value);
	}
	staging = batch;
	try {
		dirty(source);
	} finally {
		staging = null;
	}
	return value;
}

export function write<T>(source: Source<T>, value: T, origin?: number): T {
	const target = receiver();
	if (target !== null && target.fork) return stage(target, source, value, origin);
	const previous = source.v;
	if (equal(source, previous, value)) return value;
	const batch = target ?? opening();
	record(batch, source, previous, processing !== null && processing !== batch);
	if (batch.after !== null) batch.after.set(source, value);
	remember(source, previous);
	source.v = value;
	source.wv = stamp();
	if (batch.after !== null || pending.length > 0)
		(batch.origins ??= new Map()).set(source, { order: origin ?? batch.order, version: source.wv });
	if (DEV) {
		updated(source, value, batch);
		if (processing !== null) loopWrite(source);
	}
	written(source);
	readDuringRun(source);
	if (view !== null) {
		if (view.batch === batch) forget(source);
		else conceal(source, previous, batch);
	}
	dirty(source);
	runEager();
	return value;
}

export function apply(batch: Batch): void {
	for (const [source, value] of batch.after ?? []) {
		beforeOf(batch).set(source, source.v);
		if (source.kind === DERIVED) {
			const derived = source as Derived;
			present(() => {
				for (const dep of derived.deps ?? []) if (dep.kind === DERIVED) refresh(dep as Derived);
			});
			derived.status = CLEAN;
			derived.rv = stamp();
			derived.failure = null;
		}
		if (equal(source, source.v, value)) continue;
		remember(source, source.v);
		source.v = value;
		source.wv = stamp();
		const origin = batch.origins?.get(source);
		if (origin !== undefined) batch.origins!.set(source, { ...origin, version: source.wv });
		if (DEV) applied(source, batch);
		dirty(source, batch.order);
	}
	runEager();
}

function created(a: Effect, b: Effect): number {
	return a.order - b.order;
}

function resolve(pass: readonly Effect[], forced: Set<Effect> | null): Effect[] {
	const roots: Effect[] = [];
	for (const effect of pass) {
		if (effect.destroyed) continue;
		if (effect.status === CLEAN && (forced === null || !forced.has(effect))) continue;
		let top = effect;
		let covered = false;
		while (top.parent !== null) {
			top = top.parent;
			if (top.pending) {
				covered = true;
				break;
			}
			top.pending = true;
		}
		if (top === effect) {
			covered = effect.pending;
			effect.pending = true;
		}
		if (!covered) roots.push(top);
	}
	if (roots.length > 1) roots.sort(created);
	return roots;
}

function unmark(effect: Effect): void {
	effect.pending = false;
	for (let child = effect.first; child !== null; child = child.next)
		if (child.pending) unmark(child);
}

function traverse(effect: Effect, batch: Batch, content: Effect[]): void {
	effect.pending = false;
	for (let child = effect.first; child !== null; child = child.next) {
		if (child.destroyed) continue;
		if (drafting !== 0) {
			const fork = forkOf(child);
			if (fork !== null && fork !== batch) {
				handOver(child, fork);
				continue;
			}
		}
		if (child.inert && (batch.shown === null || !batch.shown.has(child))) {
			if (child.pending) overlook(child, batch);
			continue;
		}
		if (batch.skipped !== null && batch.skipped.has(child)) {
			if (child.pending) {
				unmark(child);
				overlooked.add(child);
			}
			continue;
		}
		const forced = batch.forced?.has(child) === true;
		switch (child.kind) {
			case BLOCK:
				if (forced) batch.forced?.delete(child);
				if ((forced || child.status !== CLEAN) && due(child, forced, batch)) run(child);
				break;
			case TEMPLATE:
				content.push(child);
				break;
			case EFFECT:
				if (forced || child.status !== CLEAN) batch.effects.push(child);
				break;
		}
		if (child.pending) traverse(child, batch, content);
	}
}

function commit(batch: Batch): void {
	if (batch.commits.length === 0) return;
	const commits = batch.commits.splice(0);
	let index = 0;
	try {
		for (; index < commits.length; index++) (commits[index] as Change).prepare?.();
	} catch (error) {
		batch.commits.unshift(...commits.slice(0, index), ...commits.slice(index + 1));
		throw error;
	}
	try {
		for (index = 0; index < commits.length; index++) (commits[index] as Change).apply();
	} catch (error) {
		batch.commits.unshift(...commits.slice(index + 1));
		throw error;
	}
}

export function process(batch: Batch): void {
	const outerBatch = processing;
	const outerCreation = enterScheduler();
	const outerView = setView(others(batch) ? viewOf(batch) : null);
	setProcessing(batch);
	batch.started = true;
	const content: Effect[] = [];
	const leftover: Effect[] = [];
	try {
		let passes = 0;
		let merging = true;
		reconcile(batch);
		while (batch.queued.length > 0 || (batch.commits.length > 0 && !holds(batch))) {
			if (++passes > limit) {
				exceeded(batch, content);
				return;
			}
			batch.phase = 'structure';
			const pass = batch.queued.splice(0);
			batch.members = null;
			const roots = resolve(pass, batch.forced);
			if (batch.fork) for (const root of roots) (batch.roots ??= new Set()).add(root);
			try {
				for (const root of roots) traverse(root, batch, content);
			} catch (error) {
				for (const root of roots) unmark(root);
				leftover.push(...pass);
				throw error;
			}
			if (holds(batch)) break;
			if (merging && batch.queued.length > 0) continue;
			if (merging) {
				merging = false;
				if (absorb(batch, content)) return;
			}
			batch.phase = 'commit';
			commit(batch);
		}
		if (holds(batch)) {
			hold(batch, content);
			return;
		}
		if (merging && absorb(batch, content)) return;
		batch.phase = 'content';
		const deferred = batch.content;
		batch.content = null;
		if (deferred !== null) settle(deferred, true, batch, leftover);
		settle(content, false, batch, leftover);
		batch.phase = 'effects';
		const effects = batch.deferred;
		batch.deferred = null;
		if (effects !== null) settle(effects, true, batch, leftover);
		settle(batch.effects.splice(0), false, batch, leftover);
		batch.discards = null;
		finish(batch);
	} catch (error) {
		batch.phase = null;
		setProcessing(outerBatch);
		if (!batch.done) rescue(batch, [...leftover, ...content]);
		throw error;
	} finally {
		batch.phase = null;
		setProcessing(outerBatch);
		leaveScheduler(outerCreation);
		setView(outerView);
	}
}

function next(): Batch | null {
	for (const batch of pending)
		if (!batch.done && batch.phase === null && (batch.queued.length > 0 || !holds(batch)))
			return batch;
	return open;
}

export function flushSync<T = void>(fn?: () => T): T {
	let result: T | undefined;
	if (fn !== undefined) {
		flushSync();
		result = fn();
	}
	if (!joins(processing)) flush(true);
	return result as T;
}

function exceeded(batch: Batch, content: readonly Effect[]): void {
	if (batch === open) setOpen(null);
	const latest = batch.queued.at(-1);
	abandon(batch, content);
	if (DEV) reportLoop();
	const error = depthExceeded();
	if (latest === undefined) throw error;
	overflow(latest, error);
}

function flush(tasks: boolean): void {
	let rounds = 0;
	if (DEV && processing === null) resetLoop();
	drain();
	for (let batch = next(); batch !== null; batch = next()) {
		if (++rounds > limit) {
			exceeded(batch, []);
			rounds = 0;
		} else {
			if (batch === open) setOpen(null);
			process(batch);
		}
		if (tasks) drain();
	}
	quieted();
}

onFlush(() => flush(false));
