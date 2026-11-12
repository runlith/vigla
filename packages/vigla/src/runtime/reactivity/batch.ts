import { DEV } from 'esm-env';
import type { AsyncRun } from './async.ts';
import {
	BRANCH,
	CLEAN,
	FORKED,
	PENDING,
	ROOT,
	isDestroyed,
	isInert,
	type Effect,
	type Source
} from './graph.ts';
import { clear, detach, enter, sequence, type History, type Origin } from './history.ts';
import { forgotten } from './provenance.ts';
import { parked, showing } from './tallies.ts';

type Phase = 'structure' | 'commit' | 'content' | 'effects';
export type Transfer = (from: Batch, into: Batch) => void;

export interface Change {
	prepare?(): void;
	apply(): void;
}

export interface Batch extends History {
	after: Map<Source, unknown> | null;
	origins: Map<Source, Origin> | null;
	runs: Map<Effect, AsyncRun> | null;
	reads: Map<Effect, ReadonlyMap<Source, unknown>> | null;
	readonly queued: Effect[];
	readonly commits: Change[];
	merges: Transfer[] | null;
	readonly effects: Effect[];
	discards: (() => void)[] | null;
	content: Effect[] | null;
	deferred: Effect[] | null;
	members: Set<Effect> | null;
	forced: Set<Effect> | null;
	skipped: Set<Effect> | null;
	shown: Set<Effect> | null;
	owners: Map<Effect, number> | null;
	roots: Set<Effect> | null;
	waits: Map<Batch, Set<Effect>> | null;
	settles: (() => void)[] | null;
	into: Batch | null;
	folded: Set<number> | null;
	work: number;
	phase: Phase | null;
	started: boolean;
	fork: boolean;
	held: boolean;
	done: boolean;
	discarded: boolean;
}

export function createBatch(): Batch {
	const created: Batch = {
		order: sequence(),
		log: [],
		map: null,
		prior: null,
		passed: null,
		retired: null,
		crowded: false,
		after: null,
		origins: null,
		runs: null,
		reads: null,
		queued: [],
		commits: [],
		merges: null,
		effects: [],
		discards: null,
		content: null,
		deferred: null,
		members: null,
		forced: null,
		skipped: null,
		shown: null,
		owners: null,
		roots: null,
		waits: null,
		settles: null,
		into: null,
		folded: null,
		work: 0,
		phase: null,
		started: false,
		fork: false,
		held: false,
		done: false,
		discarded: false
	};
	enter(created);
	return created;
}

export function release(batch: Batch): void {
	if (DEV) forgotten(batch);
	batch.runs = null;
	batch.merges = null;
	batch.origins = null;
	batch.reads = null;
	batch.folded = null;
	clear(batch);
}

export let open: Batch | null = null;
export let processing: Batch | null = null;
export let active: Batch | null = null;
export const pending: Batch[] = [];
export let concealed = 0;
export function conceal(delta: 1 | -1): void {
	concealed += delta;
}
export const overlooked = new WeakSet<Effect>();
let requested = false;
let flusher: () => void = () => {};

export function setOpen(next: Batch | null): void {
	open = next;
}

export function setProcessing(next: Batch | null): Batch | null {
	const previous = processing;
	processing = next;
	return previous;
}

export function setActive(next: Batch | null): Batch | null {
	const previous = active;
	active = next;
	return previous;
}

export function onFlush(flush: () => void): void {
	flusher = flush;
}

export function alias(batch: Batch): Batch {
	let found = batch;
	while (found.into !== null) found = found.into;
	return found;
}

export function joins(batch: Batch | null): batch is Batch {
	return batch !== null && (batch.phase === 'structure' || batch.phase === 'commit');
}

export function receiver(): Batch | null {
	return active ?? (joins(processing) ? processing : null);
}

export function request(): void {
	if (requested) return;
	requested = true;
	queueMicrotask(() => {
		requested = false;
		if (processing === null) flusher();
	});
}

export function opening(): Batch {
	if (open === null) {
		open = createBatch();
		request();
	}
	return open;
}

export function receiving(): Batch {
	return receiver() ?? opening();
}

export function current(): Batch {
	return receiving();
}

export function holds(batch: Batch): boolean {
	if (batch.fork) return true;
	if (batch.work === 0) return false;
	const owners = batch.owners;
	if (owners === null || (batch.skipped === null && concealed === 0)) return true;
	let free = batch.work;
	for (const [effect, count] of owners) if (excluded(effect, batch)) free -= count;
	return free > 0;
}

export function excluded(effect: Effect, batch: Batch): boolean {
	const skipped = batch.skipped;
	const shown = batch.shown;
	for (let at: Effect | null = effect; at !== null; at = at.parent) {
		if (skipped !== null && skipped.has(at)) return true;
		if (isInert(at) && (shown === null || !shown.has(at))) return true;
	}
	return false;
}

export function live(batch: Batch | null): Batch | null {
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

export function members(batch: Batch): Set<Effect> {
	return (batch.members ??= new Set(batch.queued));
}

export function enqueue(batch: Batch, effect: Effect): void {
	const known = batch.members;
	if (known !== null) {
		if (known.has(effect)) return;
		known.add(effect);
	}
	const queued = batch.queued;
	queued[queued.length] = effect;
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

export function atCommit(change: Change): void {
	if (joins(processing)) processing.commits.push(change);
	else {
		change.prepare?.();
		change.apply();
	}
}

export function atDiscard(fn: () => void): void {
	if (joins(processing)) (processing.discards ??= []).push(fn);
}

export function atMerge(fn: Transfer): void {
	if (joins(processing)) (processing.merges ??= []).push(fn);
}

export function onMerge(batch: Batch, fn: Transfer): void {
	const found = alias(batch);
	if (!found.done) (found.merges ??= []).push(fn);
}

export function onCommit(batch: Batch, change: Change): void {
	const found = alias(batch);
	if (found.done) return;
	found.commits.push(change);
	if (found.started && found !== processing && !holds(found)) request();
}

export function skip(effect: Effect, batch: Batch | null = processing): void {
	if (batch !== null) (alias(batch).skipped ??= new Set()).add(effect);
}

function carries(batch: Batch | null, order: number): boolean {
	return (
		batch !== null &&
		!batch.done &&
		(batch.order === order || (batch.folded !== null && batch.folded.has(order)))
	);
}

function foreign(effect: Effect, batch: Batch): boolean {
	const order = effect.batch;
	if (order === 0 || order === batch.order) return false;
	if ((effect.flags & FORKED) !== 0 || carries(batch, order) || carries(open, order)) return true;
	for (let index = 0; index < pending.length; index++)
		if (carries(pending[index] as Batch, order)) return true;
	return false;
}

export function admit(batch: Batch, effect: Effect): void {
	const found = alias(batch);
	if (!found.done) (found.shown ??= new Set()).add(effect);
}

function skippedElsewhere(effect: Effect, batch: Batch): boolean {
	if (open !== null && open !== batch && open.skipped?.has(effect) === true) return true;
	for (let index = 0; index < pending.length; index++) {
		const other = pending[index] as Batch;
		if (other !== batch && !other.done && other.skipped?.has(effect) === true) return true;
	}
	return false;
}

export function unskip(effect: Effect): void {
	const batch = processing;
	if (batch === null) return;
	const skipped = batch.skipped !== null && batch.skipped.delete(effect);
	if (isInert(effect) || skippedElsewhere(effect, batch)) (batch.shown ??= new Set()).add(effect);
	if (skipped || foreign(effect, batch) || overlooked.has(effect)) requeue(batch, effect);
}

export function processed(): Batch | null {
	return processing;
}

export function force(batch: Batch, effect: Effect): void {
	if (isDestroyed(effect)) return;
	(batch.forced ??= new Set()).add(effect);
	enqueue(batch, effect);
}

function gather(
	effect: Effect,
	out: Effect[],
	marked: boolean,
	adopter: Batch | null = null
): void {
	if (marked) effect.flags &= ~PENDING;
	for (let child = effect.first; child !== null; child = child.next) {
		if (isDestroyed(child)) continue;
		if (
			child.kind !== BRANCH &&
			child.kind !== ROOT &&
			(child.status !== CLEAN || (adopter !== null && foreign(child, adopter)))
		)
			out.push(child);
		if (!marked || (child.flags & PENDING) !== 0) gather(child, out, marked, adopter);
	}
}

export function overlook(branch: Effect, from: Batch): void {
	const found: Effect[] = [];
	gather(branch, found, true);
	overlooked.add(branch);
	if (found.length === 0 || from.fork) return;
	const pass = (other: Batch | null): void => {
		if (other === null || other === from || other.done) return;
		if (other.shown === null || !other.shown.has(branch)) return;
		for (const effect of found) force(other, effect);
		request();
	};
	for (const other of pending) pass(other);
	pass(open);
}

export function handOver(effect: Effect, holder: Batch): void {
	const found: Effect[] = [];
	if (effect.status !== CLEAN && effect.kind !== BRANCH && effect.kind !== ROOT) found.push(effect);
	gather(effect, found, true);
	if (found.length === 0) return;
	if (!pending.includes(holder)) pending.push(holder);
	for (const each of found) force(holder, each);
	request();
}

export function requeue(batch: Batch, branch: Effect): void {
	overlooked.delete(branch);
	const found: Effect[] = [];
	gather(branch, found, false, batch);
	for (const effect of found) force(batch, effect);
}

function park(batch: Batch): void {
	const index = pending.indexOf(batch);
	if (index !== -1) pending.splice(index, 1);
	batch.queued.length = 0;
	batch.commits.length = 0;
	batch.effects.length = 0;
	batch.members = batch.forced = batch.skipped = batch.shown = batch.waits = null;
	batch.content = batch.deferred = batch.discards = null;
	batch.runs = null;
	batch.merges = null;
	for (const other of pending) other.waits?.delete(batch);
	open?.waits?.delete(batch);
	detach(batch);
}

export function orphaned(root: Effect): void {
	if (pending.length === 0) return;
	for (const batch of [...pending]) {
		const roots = batch.roots;
		if (!batch.fork || roots === null || !roots.delete(root)) continue;
		if (roots.size === 0) park(batch);
	}
}

export function untouched(batch: Batch): void {
	if (batch.fork && batch.roots === null && !batch.done) park(batch);
}

export function rerunAfter(reader: Batch, writer: Batch, effects: Iterable<Effect>): void {
	if (writer.done) return;
	if (writer === reader) {
		for (const effect of effects) force(reader, effect);
		return;
	}
	const waits = (reader.waits ??= new Map());
	let found = waits.get(writer);
	if (found === undefined) waits.set(writer, (found = new Set()));
	for (const effect of effects) found.add(effect);
}

export function revisit(effect: Effect, hidden: Set<Batch> | null): void {
	const reader = active ?? processing;
	for (const found of hidden ?? []) {
		const writer = alias(found);
		if (writer.done) continue;
		if (members(writer).has(effect)) (writer.forced ??= new Set()).add(effect);
		if (reader !== null && reader !== writer) rerunAfter(reader, writer, [effect]);
	}
	for (const other of pending) {
		if (other === reader || other.done || other.fork || other.queued.length === 0) continue;
		if (members(other).has(effect)) (other.forced ??= new Set()).add(effect);
	}
}

export function tick(): Promise<void> {
	return new Promise((done) => {
		if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => done());
		setTimeout(done, 0);
	});
}
