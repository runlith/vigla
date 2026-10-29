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
	type Reaction,
	type Source
} from './graph.ts';
import { run } from './effects.ts';
import { depthExceeded } from './errors.ts';
import {
	forget,
	owner,
	readDuringRun,
	recalling,
	setOwner,
	setView,
	stale,
	untrack,
	view,
	written,
	type View
} from './tracking.ts';

type Phase = 'structure' | 'commit' | 'content' | 'effects';

const limit = 1000;

export class Batch {
	readonly before = new Map<Source, unknown>();
	readonly after = new Map<Source, unknown>();
	readonly queued: Effect[] = [];
	readonly commits: (() => void)[] = [];
	readonly discards: (() => void)[] = [];
	readonly effects: Effect[] = [];
	readonly content: Effect[] = [];
	readonly deferred: Effect[] = [];
	forced: Set<Effect> | null = null;
	skipped: Set<Effect> | null = null;
	waits: Map<Batch, Set<Effect>> | null = null;
	settles: (() => void)[] | null = null;
	work = 0;
	phase: Phase | null = null;
	started = false;
	fork = false;
	done = false;
}

let open: Batch | null = null;
let processing: Batch | null = null;
let active: Batch | null = null;
const pending: Batch[] = [];
let waiting: (() => void)[] = [];
let requested = false;

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

function receiving(): Batch {
	if (active !== null) return active;
	if (joins(processing)) return processing;
	if (open === null) {
		open = new Batch();
		request();
	}
	return open;
}

export function current(): Batch {
	return active ?? processing ?? receiving();
}

export function holds(batch: Batch): boolean {
	return batch.fork || batch.work > 0;
}

export function within<T>(batch: Batch, fn: () => T): T {
	const previous = active;
	active = batch.done ? null : batch;
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
		active = batch === null || batch.done ? null : batch;
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
	receiving().queued.push(effect);
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

function mark(source: Source, status: typeof DIRTY | typeof MAYBE, seen: Set<Source> | null): void {
	const reactions = source.reactions;
	if (reactions === null) return;
	for (const reaction of reactions) {
		const previous = reaction.status;
		if (previous < status) reaction.status = status;
		if (isDerived(reaction)) {
			if (seen === null ? previous === CLEAN : !seen.has(reaction)) {
				seen?.add(reaction);
				mark(reaction, MAYBE, seen);
			}
		} else if (seen !== null || previous === CLEAN) schedule(reaction as Effect);
	}
}

function dirty(source: Source): void {
	mark(source, DIRTY, pending.length > 0 ? new Set() : null);
}

export function write<T>(source: Source<T>, value: T): T {
	const batch = receiving();
	if (batch.fork) {
		const shown = batch.after.has(source) ? batch.after.get(source) : source.v;
		if (Object.is(shown, value)) return value;
		if (!batch.before.has(source)) batch.before.set(source, source.v);
		batch.after.set(source, value);
		if (view !== null && view.batch === batch) {
			forget(source);
			view.values.set(source, value);
		}
		dirty(source);
		return value;
	}
	if (Object.is(source.v, value)) return value;
	if (!batch.before.has(source)) batch.before.set(source, source.v);
	batch.after.set(source, value);
	source.v = value;
	source.wv = stamp();
	written(source);
	readDuringRun(source);
	if (view !== null) forget(source);
	dirty(source);
	return value;
}

export function apply(batch: Batch): void {
	for (const [source, value] of batch.after) {
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
	if (processing !== null && processing.phase === 'structure') processing.discards.push(fn);
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

function others(batch: Batch): boolean {
	if (batch.fork || (open !== null && open !== batch)) return true;
	for (const other of pending) if (other !== batch && !other.fork) return true;
	return false;
}

function viewOf(batch: Batch): View {
	const given: View = {
		batch,
		values: new Map(),
		hidden: new Map(),
		checked: new Map(),
		reached: new Map()
	};
	const hide = (other: Batch): void => {
		if (other === batch || other.fork || other.done) return;
		for (const [source, value] of other.before) {
			if (batch.after.has(source) || given.values.has(source)) continue;
			given.values.set(source, value);
			given.hidden.set(source, other);
		}
	};
	for (const other of pending) hide(other);
	if (open !== null) hide(open);
	for (const [source, value] of batch.after)
		if (!Object.is(source.v, value)) given.values.set(source, value);
	return given;
}

export function revisit(effect: Effect, hidden: Set<Batch>): void {
	const reader = active ?? processing;
	for (const writer of hidden) {
		if (writer.done) continue;
		if (writer.queued.includes(effect)) (writer.forced ??= new Set()).add(effect);
		if (reader === null || reader === writer) continue;
		const waits = (reader.waits ??= new Map());
		let found = waits.get(writer);
		if (found === undefined) waits.set(writer, (found = new Set()));
		found.add(effect);
	}
}

function intersects(a: Batch, b: Batch): boolean {
	const [small, large] = a.before.size < b.before.size ? [a, b] : [b, a];
	for (const source of small.before.keys()) if (large.before.has(source)) return true;
	return false;
}

function absorb(batch: Batch): Batch {
	for (const held of pending) {
		if (held.fork || held.done || !intersects(batch, held)) continue;
		for (const [source, value] of batch.before)
			if (!held.before.has(source)) held.before.set(source, value);
		for (const [source, value] of batch.after) held.after.set(source, value);
		held.queued.push(...batch.queued);
		held.effects.push(...batch.effects);
		if (batch.settles !== null) (held.settles ??= []).push(...batch.settles);
		batch.done = true;
		return held;
	}
	return batch;
}

function resolve(batch: Batch): Effect[] {
	const roots = new Set<Effect>();
	const forced = batch.forced;
	for (const effect of batch.queued.splice(0)) {
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

function settle(effects: readonly Effect[], force: boolean): void {
	for (let index = 0; index < effects.length; index++) {
		const effect = effects[index] as Effect;
		if (effect.destroyed || effect.inert || effect.running) continue;
		if (force) effect.status = DIRTY;
		if (stale(effect)) run(effect);
	}
}

function share(effect: Effect, batch: Batch): void {
	const pass = (other: Batch | null): void => {
		if (other === null || other === batch || other.done || !other.queued.includes(effect)) return;
		(other.forced ??= new Set()).add(effect);
	};
	pass(open);
	for (const other of pending) pass(other);
}

function defer(effects: readonly Effect[], batch: Batch, into: Effect[]): void {
	for (const effect of effects) {
		if (effect.destroyed || into.includes(effect) || !stale(effect)) continue;
		effect.status = CLEAN;
		into.push(effect);
		share(effect, batch);
	}
}

function hold(batch: Batch, content: readonly Effect[]): void {
	defer(content, batch, batch.content);
	defer(batch.effects.splice(0), batch, batch.deferred);
	if (!pending.includes(batch)) pending.push(batch);
}

function depends(
	reaction: Reaction,
	sources: Map<Source, unknown>,
	memo: Map<Reaction, boolean>
): boolean {
	const known = memo.get(reaction);
	if (known !== undefined) return known;
	memo.set(reaction, false);
	let found = false;
	for (const dep of reaction.deps ?? []) {
		if (sources.has(dep) || (isDerived(dep) && depends(dep, sources, memo))) {
			found = true;
			break;
		}
	}
	memo.set(reaction, found);
	return found;
}

function rebase(batch: Batch, committed: Batch, changed: readonly Source[]): void {
	const rerun = new Set<Effect>(batch.waits?.get(committed) ?? []);
	batch.waits?.delete(committed);
	const memo = new Map<Reaction, boolean>();
	const seen = new Set<Source>();
	const visit = (source: Source): void => {
		if (seen.has(source)) return;
		seen.add(source);
		for (const reaction of source.reactions ?? []) {
			if (isDerived(reaction)) visit(reaction);
			else if (depends(reaction, batch.before, memo)) rerun.add(reaction as Effect);
		}
	};
	for (const source of changed) {
		if (batch.after.has(source) && !Object.is(source.v, batch.after.get(source)) && !batch.fork) {
			batch.before.delete(source);
			batch.after.delete(source);
		}
		visit(source);
	}
	for (const effect of rerun) {
		if (effect.destroyed) continue;
		(batch.forced ??= new Set()).add(effect);
		batch.queued.push(effect);
	}
	if (batch.queued.length > 0) request();
}

function end(batch: Batch): void {
	batch.done = true;
	const index = pending.indexOf(batch);
	if (index !== -1) pending.splice(index, 1);
	for (const done of batch.settles ?? []) done();
	batch.settles = null;
}

function finish(batch: Batch): void {
	end(batch);
	const changed: Source[] = [];
	for (const [source, value] of batch.before)
		if (!Object.is(value, batch.after.get(source))) changed.push(source);
	for (const other of [...pending]) rebase(other, batch, changed);
}

export function discard(batch: Batch): void {
	if (batch.done) return;
	for (const fn of batch.discards.splice(0)) fn();
	end(batch);
	for (const other of pending) other.waits?.delete(batch);
}

export function waitFor(batch: Batch): Promise<void> {
	if (batch.done) return Promise.resolve();
	return new Promise((done) => (batch.settles ??= []).push(done));
}

export function adopt(batch: Batch): void {
	if (!pending.includes(batch)) pending.push(batch);
}

export function process(given: Batch): void {
	const batch = given.started || given.fork ? given : absorb(given);
	const outerBatch = processing;
	const outerView = setView(others(batch) ? viewOf(batch) : null);
	processing = batch;
	batch.started = true;
	try {
		const content: Effect[] = [];
		let passes = 0;
		while (batch.queued.length > 0 || (batch.commits.length > 0 && !holds(batch))) {
			if (++passes > limit) depthExceeded();
			batch.phase = 'structure';
			for (const root of resolve(batch)) traverse(root, batch, content);
			if (holds(batch)) break;
			batch.phase = 'commit';
			for (const fn of batch.commits.splice(0)) fn();
		}
		if (holds(batch)) {
			hold(batch, content);
			return;
		}
		batch.phase = 'content';
		settle(batch.content.splice(0), true);
		settle(content, false);
		batch.phase = 'effects';
		settle(batch.deferred.splice(0), true);
		settle(batch.effects.splice(0), false);
		batch.discards.length = 0;
		finish(batch);
	} finally {
		batch.phase = null;
		processing = outerBatch;
		setView(outerView);
	}
}

function next(): Batch | null {
	for (const batch of pending)
		if (!batch.done && (batch.queued.length > 0 || !holds(batch))) return batch;
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
