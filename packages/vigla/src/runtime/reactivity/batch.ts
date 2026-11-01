import { DEV } from 'esm-env';
import { applied, forgotten, loopWrite, reportLoop, resetLoop, updated } from './trace.ts';
import { parked, showing, type AsyncRun } from './async.ts';
import {
	BLOCK,
	CLEAN,
	DIRTY,
	EAGER,
	EFFECT,
	MAYBE,
	TEMPLATE,
	equal,
	isDerived,
	stamp,
	type Effect,
	type Reaction,
	type Source
} from './graph.ts';
import { fail, offscreen, run } from './effects.ts';
import { queueEager, runEager } from './eager.ts';
import { depthExceeded } from './errors.ts';
import { drain } from './tasks.ts';
import { clear, History, prior, record } from './history.ts';
import {
	abandon,
	absorb,
	finish,
	hold,
	others,
	overlook,
	overlooked,
	requeue,
	rescue,
	viewOf
} from './held.ts';
import {
	conceal,
	forget,
	owner,
	readDuringRun,
	recalling,
	setOwner,
	setView,
	stale,
	withoutReaction,
	view,
	written
} from './tracking.ts';

export { orphaned, revisit } from './held.ts';
export { detach } from './history.ts';

type Phase = 'structure' | 'commit' | 'content' | 'effects';
export type Transfer = (from: Batch, into: Batch) => void;

const limit = 1000;

export class Batch extends History {
	after: Map<Source, unknown> | null = null;
	runs: Map<Effect, AsyncRun> | null = null;
	readonly queued: Effect[] = [];
	readonly commits: (() => void)[] = [];
	merges: Transfer[] | null = null;
	readonly effects: Effect[] = [];
	discards: (() => void)[] | null = null;
	content: Effect[] | null = null;
	deferred: Effect[] | null = null;
	members: Set<Effect> | null = null;
	forced: Set<Effect> | null = null;
	skipped: Set<Effect> | null = null;
	shown: Set<Effect> | null = null;
	owners: Map<Effect, number> | null = null;
	roots: Set<Effect> | null = null;
	waits: Map<Batch, Set<Effect>> | null = null;
	settles: (() => void)[] | null = null;
	into: Batch | null = null;
	work = 0;
	phase: Phase | null = null;
	started = false;
	fork = false;
	held = false;
	done = false;
	discarded = false;
}

export function release(batch: Batch): void {
	if (DEV) forgotten(batch);
	batch.runs = null;
	batch.merges = null;
	clear(batch);
}

export let open: Batch | null = null;
export let processing: Batch | null = null;
export let active: Batch | null = null;
export const pending: Batch[] = [];
let waiting: (() => void)[] = [];
let requested = false;

export function alias(batch: Batch): Batch {
	let found = batch;
	while (found.into !== null) found = found.into;
	return found;
}

function joins(batch: Batch | null): batch is Batch {
	return batch !== null && (batch.phase === 'structure' || batch.phase === 'commit');
}

function receiver(): Batch | null {
	return active ?? (joins(processing) ? processing : null);
}

export function request(): void {
	if (requested) return;
	requested = true;
	queueMicrotask(() => {
		requested = false;
		if (processing === null) flush(false);
	});
}

export function opening(): Batch {
	if (open === null) {
		open = new Batch();
		request();
	}
	return open;
}

function receiving(): Batch {
	return receiver() ?? opening();
}

export function current(): Batch {
	return receiving();
}

export function holds(batch: Batch): boolean {
	if (batch.fork) return true;
	if (batch.work === 0) return false;
	const owners = batch.owners;
	if (owners === null || (batch.skipped === null && offscreen.size === 0)) return true;
	let free = batch.work;
	for (const [effect, count] of owners) if (excluded(effect, batch)) free -= count;
	return free > 0;
}

export function excluded(effect: Effect, batch: Batch): boolean {
	const skipped = batch.skipped;
	const shown = batch.shown;
	for (let at: Effect | null = effect; at !== null; at = at.parent) {
		if (skipped !== null && skipped.has(at)) return true;
		if (at.inert && (shown === null || !shown.has(at))) return true;
	}
	return false;
}

function live(batch: Batch | null): Batch | null {
	if (batch === null) return null;
	const found = alias(batch);
	return found.done ? null : found;
}

export function within<T>(batch: Batch, fn: () => T): T {
	const previous = active;
	active = live(batch);
	try {
		return fn();
	} finally {
		active = previous;
	}
}

export function quiet(): boolean {
	return processing === null && open === null;
}

export function inside<T>(batch: Batch, fn: () => T): T {
	const previous = setView(viewOf(batch));
	try {
		return within(batch, fn);
	} finally {
		setView(previous);
	}
}

export function suspend(): () => void {
	const effect = owner;
	const batch = active ?? processing;
	return () => {
		setOwner(effect);
		active = live(batch);
		if (processing === null) setView(active !== null && others(active) ? viewOf(active) : null);
	};
}

export function resumed(): void {
	if (processing !== null) return;
	setOwner(null);
	active = null;
	setView(null);
}

export function members(batch: Batch): Set<Effect> {
	return (batch.members ??= new Set(batch.queued));
}

export function enqueue(batch: Batch, effect: Effect): void {
	const known = batch.members;
	if (known !== null) {
		if (known.has(effect)) return;
		known.add(effect);
	}
	batch.queued.push(effect);
}

export function schedule(effect: Effect): void {
	const batch = receiving();
	enqueue(batch, effect);
	if (batch !== processing && batch.started) request();
}

export function collect(effect: Effect): void {
	if (effect.boundary !== null && showing(effect.boundary)) {
		parked(effect.boundary).push(effect);
		return;
	}
	const batch = receiver();
	if (batch !== null) batch.effects.push(effect);
	else schedule(effect);
}

let visits = 0;
let seen: Set<Source> | null = null;
let scheduling: Batch | null = null;

function mark(
	source: Source,
	status: typeof DIRTY | typeof MAYBE,
	all: boolean,
	forked: number
): void {
	const reactions = source.reactions;
	if (reactions === null) return;
	const length = reactions.length;
	if (seen !== null) {
		if (seen.has(source)) return;
		seen.add(source);
	} else if ((visits += length) > 10_000) seen = new Set([source]);
	for (let index = 0; index < length; index++) {
		const reaction = reactions[index] as Reaction;
		const previous = reaction.status;
		if (isDerived(reaction)) {
			if (previous < status) reaction.status = status;
			mark(reaction, MAYBE, all, forked);
			continue;
		}
		const effect = reaction as Effect;
		if (effect.kind === EAGER) {
			if (staging) continue;
			if (previous < status) effect.status = status;
			queueEager(effect);
			continue;
		}
		if (forked !== 0 && previous === CLEAN && effect.forked === forked) continue;
		if (previous < status) effect.status = status;
		if (all || previous === CLEAN) enqueue((scheduling ??= receiving()), effect);
	}
}

function dirty(source: Source, forked = 0): void {
	if (source.reactions === null) return;
	visits = 0;
	const all = pending.length > 0;
	if (all) members(receiving());
	mark(source, DIRTY, all, forked);
	seen = null;
	const batch = scheduling;
	scheduling = null;
	if (batch !== null && batch !== processing && batch.started) request();
}

let staging = false;

function staged<T>(fork: Batch, source: Source<T>, value: T): T {
	const after = (fork.after ??= new Map());
	const shown = after.has(source) ? after.get(source) : source.v;
	if (equal(source, shown as T, value)) return value;
	record(fork, source, source.v);
	after.set(source, value);
	if (DEV) updated(source, value, fork);
	if (view !== null && view.batch === fork) {
		forget(source);
		view.values.set(source, value);
	}
	staging = true;
	try {
		dirty(source);
	} finally {
		staging = false;
	}
	return value;
}

export function write<T>(source: Source<T>, value: T): T {
	const target = receiver();
	if (target !== null && target.fork) return staged(target, source, value);
	const previous = source.v;
	if (equal(source, previous, value)) return value;
	const batch = target ?? opening();
	record(batch, source, previous);
	if (batch.after !== null) batch.after.set(source, value);
	source.v = value;
	source.wv = stamp();
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
		batch.before.set(source, source.v);
		if (equal(source, source.v, value)) continue;
		source.v = value;
		source.wv = stamp();
		if (DEV) applied(source, batch);
		dirty(source, batch.order);
	}
	runEager();
}

export function retire(teardown: () => void): void {
	const batch = active ?? processing ?? open;
	if (batch === null) {
		withoutReaction(() => teardown.call(null));
		return;
	}
	const later = open !== null && open !== batch ? prior(open) : null;
	recalling(prior(batch), later, teardown);
}

export function atCommit(apply: () => void): void {
	if (processing === null || processing.phase !== 'structure') apply();
	else processing.commits.push(apply);
}

export function atDiscard(fn: () => void): void {
	if (processing !== null && processing.phase === 'structure')
		(processing.discards ??= []).push(fn);
}

export function atMerge(fn: Transfer): void {
	if (processing !== null && processing.phase === 'structure') (processing.merges ??= []).push(fn);
}

export function skip(effect: Effect): void {
	if (processing !== null) (processing.skipped ??= new Set()).add(effect);
}

export function unskip(effect: Effect): void {
	const batch = processing;
	if (batch === null) return;
	const skipped = batch.skipped !== null && batch.skipped.delete(effect);
	(batch.shown ??= new Set()).add(effect);
	const forked = effect.forked !== 0 && effect.forked !== batch.order;
	if (skipped || forked || overlooked.has(effect)) requeue(batch, effect);
}

export function processed(): Batch | null {
	return processing;
}

function resolve(pass: readonly Effect[], forced: Set<Effect> | null): Effect[] {
	const roots = new Set<Effect>();
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
		if (!covered) roots.add(top);
	}
	return [...roots].sort((a, b) => a.order - b.order);
}

function unmark(effect: Effect): void {
	effect.pending = false;
	for (let child = effect.first; child !== null; child = child.next)
		if (child.pending) unmark(child);
}

function due(effect: Effect): boolean {
	try {
		return stale(effect);
	} catch (error) {
		effect.status = CLEAN;
		throw error;
	}
}

function traverse(effect: Effect, batch: Batch, content: Effect[]): void {
	effect.pending = false;
	for (let child = effect.first; child !== null; child = child.next) {
		if (child.destroyed) continue;
		if (child.inert && (batch.shown === null || !batch.shown.has(child))) {
			if (child.pending) overlook(child, batch);
			continue;
		}
		if (batch.skipped !== null && batch.skipped.has(child)) {
			if (child.pending) unmark(child);
			continue;
		}
		if (batch.forced !== null && batch.forced.delete(child)) child.status = DIRTY;
		switch (child.kind) {
			case BLOCK:
				if (child.status !== CLEAN && due(child)) run(child);
				break;
			case TEMPLATE:
				if (child.status !== CLEAN) content.push(child);
				break;
			case EFFECT:
				if (child.status !== CLEAN) batch.effects.push(child);
				break;
		}
		if (child.pending) traverse(child, batch, content);
	}
}

function settle(
	effects: readonly Effect[],
	force: boolean,
	batch: Batch,
	leftover: Effect[]
): void {
	const walk = batch.skipped !== null || offscreen.size > 0;
	let index = 0;
	try {
		for (; index < effects.length; index++) {
			const effect = effects[index] as Effect;
			if (effect.destroyed || effect.running) continue;
			if (walk ? excluded(effect, batch) : effect.inert) continue;
			if (force) effect.status = DIRTY;
			if (due(effect)) run(effect);
		}
	} catch (error) {
		for (let rest = index + 1; rest < effects.length; rest++) {
			const effect = effects[rest] as Effect;
			if (force) effect.status = DIRTY;
			leftover.push(effect);
		}
		throw error;
	}
}

function commit(batch: Batch): void {
	const commits = batch.commits.splice(0);
	let index = 0;
	try {
		for (; index < commits.length; index++) (commits[index] as () => void)();
	} catch (error) {
		batch.commits.unshift(...commits.slice(index + 1));
		throw error;
	}
}

export function process(batch: Batch): void {
	const outerBatch = processing;
	const outerView = setView(others(batch) ? viewOf(batch) : null);
	processing = batch;
	batch.started = true;
	const content: Effect[] = [];
	const leftover: Effect[] = [];
	try {
		let passes = 0;
		let merging = true;
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
		processing = outerBatch;
		if (!batch.done) rescue(batch, [...leftover, ...content]);
		throw error;
	} finally {
		batch.phase = null;
		processing = outerBatch;
		setView(outerView);
	}
}

function next(): Batch | null {
	for (const batch of pending)
		if (!batch.done && batch.phase === null && (batch.queued.length > 0 || !holds(batch)))
			return batch;
	return open;
}

function idle(): boolean {
	if (open !== null || processing !== null) return false;
	for (const batch of pending) if (!batch.fork) return false;
	return true;
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
	if (batch === open) open = null;
	const latest = batch.queued.at(-1);
	abandon(batch, content);
	if (DEV) reportLoop();
	const error = depthExceeded();
	if (latest === undefined) throw error;
	fail(latest, error);
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
			if (batch === open) open = null;
			process(batch);
		}
		if (tasks) drain();
	}
	if (idle() && waiting.length > 0) {
		const resolved = waiting;
		waiting = [];
		for (const done of resolved) done();
	}
}

export function settled(): Promise<void> {
	receiving();
	return new Promise((done) => waiting.push(done));
}

export function tick(): Promise<void> {
	return new Promise((done) => {
		if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => done());
		setTimeout(done, 0);
	});
}
