import { parked, showing } from './async.ts';
import {
	BLOCK,
	CLEAN,
	DIRTY,
	EFFECT,
	MAYBE,
	TEMPLATE,
	isDerived,
	stamp,
	type Effect,
	type Source
} from './graph.ts';
import { run } from './effects.ts';
import { depthExceeded } from './errors.ts';
import { absorb, finish, hold, others, rescue, viewOf } from './held.ts';
import {
	conceal,
	forget,
	owner,
	readDuringRun,
	recalling,
	setOwner,
	setView,
	stale,
	untrack,
	view,
	written
} from './tracking.ts';

export { revisit } from './held.ts';

type Phase = 'structure' | 'commit' | 'content' | 'effects';

const limit = 1000;

let batches = 0;

export class Batch {
	readonly order = ++batches;
	readonly before = new Map<Source, unknown>();
	after: Map<Source, unknown> | null = null;
	readonly queued: Effect[] = [];
	readonly commits: (() => void)[] = [];
	readonly effects: Effect[] = [];
	discards: (() => void)[] | null = null;
	content: Effect[] | null = null;
	deferred: Effect[] | null = null;
	forced: Set<Effect> | null = null;
	skipped: Set<Effect> | null = null;
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

export function request(): void {
	if (requested) return;
	requested = true;
	queueMicrotask(() => {
		requested = false;
		if (processing === null) flushSync();
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
	if (active !== null) return active;
	if (joins(processing)) return processing;
	return opening();
}

export function current(): Batch {
	return receiving();
}

export function holds(batch: Batch): boolean {
	return batch.fork || batch.work > 0;
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

export function schedule(effect: Effect): void {
	const batch = receiving();
	batch.queued.push(effect);
	if (batch !== processing && batch.started) request();
}

export function collect(effect: Effect): void {
	if (effect.boundary !== null && showing(effect.boundary)) {
		parked(effect.boundary).push(effect);
		return;
	}
	const batch = active ?? (joins(processing) ? processing : null);
	if (batch !== null) batch.effects.push(effect);
	else schedule(effect);
}

let visits = 0;
let seen: Set<Source> | null = null;

function mark(source: Source, status: typeof DIRTY | typeof MAYBE, all: boolean): void {
	const reactions = source.reactions;
	if (reactions === null) return;
	if (seen !== null) {
		if (seen.has(source)) return;
		seen.add(source);
	} else if ((visits += reactions.size) > 10_000) seen = new Set([source]);
	for (const reaction of reactions) {
		const previous = reaction.status;
		if (previous < status) reaction.status = status;
		if (isDerived(reaction)) mark(reaction, MAYBE, all);
		else if (all || previous === CLEAN) schedule(reaction as Effect);
	}
}

function dirty(source: Source): void {
	visits = 0;
	mark(source, DIRTY, pending.length > 0);
	seen = null;
}

function staged<T>(fork: Batch, source: Source<T>, value: T): T {
	const after = (fork.after ??= new Map());
	const shown = after.has(source) ? after.get(source) : source.v;
	if (Object.is(shown, value)) return value;
	if (!fork.before.has(source)) fork.before.set(source, source.v);
	after.set(source, value);
	if (view !== null && view.batch === fork) {
		forget(source);
		view.values.set(source, value);
	}
	dirty(source);
	return value;
}

export function write<T>(source: Source<T>, value: T): T {
	const target = active ?? (joins(processing) ? processing : null);
	if (target !== null && target.fork) return staged(target, source, value);
	const previous = source.v;
	if (Object.is(previous, value)) return value;
	const batch = target ?? opening();
	if (!batch.before.has(source)) batch.before.set(source, previous);
	if (batch.after !== null) batch.after.set(source, value);
	source.v = value;
	source.wv = stamp();
	written(source);
	readDuringRun(source);
	if (view !== null) {
		if (view.batch === batch) forget(source);
		else conceal(source, previous, batch);
	}
	dirty(source);
	return value;
}

export function apply(batch: Batch): void {
	for (const [source, value] of batch.after ?? []) {
		batch.before.set(source, source.v);
		if (Object.is(source.v, value)) continue;
		source.v = value;
		source.wv = stamp();
		dirty(source);
	}
}

export function retire(teardown: () => void): void {
	const batch = active ?? processing ?? open;
	if (batch === null) {
		untrack(() => teardown.call(null));
		return;
	}
	const later = open !== null && open !== batch ? open.before : null;
	recalling(batch.before, later, teardown);
}

export function atCommit(apply: () => void): void {
	if (processing === null || processing.phase !== 'structure') apply();
	else processing.commits.push(apply);
}

export function atDiscard(fn: () => void): void {
	if (processing !== null && processing.phase === 'structure')
		(processing.discards ??= []).push(fn);
}

export function skip(effect: Effect): void {
	if (processing !== null) (processing.skipped ??= new Set()).add(effect);
}

export function unskip(effect: Effect): void {
	processing?.skipped?.delete(effect);
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

function traverse(effect: Effect, batch: Batch, content: Effect[]): void {
	effect.pending = false;
	for (let child = effect.first; child !== null; child = child.next) {
		if (child.destroyed || child.inert) continue;
		if (batch.skipped !== null && batch.skipped.has(child)) {
			if (child.pending) unmark(child);
			continue;
		}
		if (batch.forced !== null && batch.forced.delete(child)) child.status = DIRTY;
		switch (child.kind) {
			case BLOCK:
				if (child.status !== CLEAN && stale(child)) run(child);
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

function under(effect: Effect, skipped: Set<Effect>): boolean {
	for (let at: Effect | null = effect; at !== null; at = at.parent)
		if (skipped.has(at)) return true;
	return false;
}

function settle(
	effects: readonly Effect[],
	force: boolean,
	batch: Batch,
	leftover: Effect[]
): void {
	let index = 0;
	try {
		for (; index < effects.length; index++) {
			const effect = effects[index] as Effect;
			if (effect.destroyed || effect.inert || effect.running) continue;
			if (batch.skipped !== null && under(effect, batch.skipped)) continue;
			if (force) effect.status = DIRTY;
			if (stale(effect)) run(effect);
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

export function process(given: Batch): void {
	const batch = given.started || given.fork ? given : absorb(given);
	const outerBatch = processing;
	const outerView = setView(others(batch) ? viewOf(batch) : null);
	processing = batch;
	batch.started = true;
	const content: Effect[] = [];
	const leftover: Effect[] = [];
	try {
		let passes = 0;
		while (batch.queued.length > 0 || (batch.commits.length > 0 && !holds(batch))) {
			if (++passes > limit) depthExceeded();
			batch.phase = 'structure';
			const pass = batch.queued.splice(0);
			const roots = resolve(pass, batch.forced);
			try {
				for (const root of roots) traverse(root, batch, content);
			} catch (error) {
				for (const root of roots) unmark(root);
				leftover.push(...pass);
				throw error;
			}
			if (holds(batch)) break;
			batch.phase = 'commit';
			commit(batch);
		}
		if (holds(batch)) {
			hold(batch, content);
			return;
		}
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
		rescue(batch, [...leftover, ...content]);
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
	if (!joins(processing)) {
		let rounds = 0;
		for (let batch = next(); batch !== null; batch = next()) {
			if (++rounds > limit) depthExceeded();
			if (batch === open) open = null;
			process(batch);
		}
		if (idle() && waiting.length > 0) {
			const resolved = waiting;
			waiting = [];
			for (const done of resolved) done();
		}
	}
	return result as T;
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
