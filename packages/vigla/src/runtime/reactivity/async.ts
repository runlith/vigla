import {
	alias,
	collect,
	current,
	holds,
	inside,
	onMerge,
	quieted,
	request,
	stage,
	within,
	write,
	type Batch
} from './batch.ts';
import { staleReaction } from '../../shared/abort.ts';
import { ambient } from './carried.ts';
import { application, block, fail } from './effects.ts';
import { sequence } from './history.ts';
import { changed } from './reads.ts';
import { waitFor } from './held.ts';
import { asyncOrphan, pendingOutside } from './errors.ts';
import type { Boundary, Effect, Source } from './graph.ts';
import { source } from './sources.ts';
import { awaiting, get, owner, running, settleReads, type Resumption } from './tracking.ts';

export interface AsyncRun {
	stale(): boolean;
	supersede(): void;
	adopt(batch: Batch): void;
}

interface Result {
	readonly order: number;
	readonly revision: number;
	readonly reading: Resumption;
	readonly speculative: boolean;
}

interface Tally {
	units: number;
	source: Source<number> | null;
	queued: boolean;
	readonly effects: Effect[];
}

const tallies = new WeakMap<Boundary, Tally>();

export const asynchronous = new WeakSet<Effect>();

function tally(boundary: Boundary): Tally {
	let found = tallies.get(boundary);
	if (found === undefined) {
		found = { units: 0, source: null, queued: false, effects: [] };
		tallies.set(boundary, found);
	}
	return found;
}

export function showing(boundary: Boundary | null): boolean {
	for (let at = boundary; at !== null; at = at.parent) if (at.showing) return true;
	return false;
}

export function parked(boundary: Boundary): Effect[] {
	let at = boundary;
	while (!at.showing && at.parent !== null) at = at.parent;
	return tally(at).effects;
}

export function reveal(boundary: Boundary): void {
	const found = tallies.get(boundary);
	if (found === undefined) return;
	for (const effect of found.effects.splice(0)) if (!effect.destroyed) collect(effect);
}

function count(boundary: Boundary | null, delta: 1 | -1): void {
	if (boundary === null) return;
	const found = tally(boundary);
	found.units += delta;
	boundary.settle(delta);
	if (found.source === null || found.queued) return;
	found.queued = true;
	queueMicrotask(() => {
		found.queued = false;
		if (found.source !== null) write(found.source, found.units);
	});
}

let outstanding = 0;
const watchers = new Set<() => void>();
const speculative = new WeakSet<() => void>();
let drains: (() => void)[] = [];

export function unsettled(): boolean {
	return outstanding > 0;
}

function released(): void {
	if (--outstanding === 0) {
		quieted();
		const resolved = drains;
		drains = [];
		for (const done of resolved) done();
	}
	recheck();
}

function recheck(): void {
	if (watchers.size === 0) return;
	for (const check of [...watchers]) check();
}

function busy(effect: Effect): boolean {
	if (effect.destroyed) return false;
	for (const settle of effect.units ?? []) if (!speculative.has(settle)) return true;
	for (let child = effect.first; child !== null; child = child.next) if (busy(child)) return true;
	return false;
}

export function unit(holder: Effect | null): () => void {
	outstanding++;
	let open = true;
	const settle = (): void => {
		if (!open) return;
		open = false;
		holder?.units?.delete(settle);
		released();
	};
	if (holder !== null && !holder.destroyed) (holder.units ??= new Set()).add(settle);
	return settle;
}

export function drained(): Promise<void> {
	const effect = ambient();
	if (effect !== null) return settledUnder(application(effect));
	return new Promise((done) => {
		if (outstanding === 0) queueMicrotask(done);
		else drains.push(done);
	});
}

export function settledUnder(effect: Effect): Promise<void> {
	return new Promise((done) => {
		let confirming = false;
		const check = (): void => {
			if (confirming || busy(effect)) return;
			confirming = true;
			queueMicrotask(() => {
				confirming = false;
				if (busy(effect)) return;
				watchers.delete(check);
				done();
			});
		};
		watchers.add(check);
		check();
	});
}

export async function hold<T>(fn: () => T): Promise<Awaited<T>> {
	const finish = work();
	try {
		return await fn();
	} finally {
		finish();
	}
}

export function work(): () => void {
	const batch = current();
	const holder = owner;
	const boundary = holder === null ? null : holder.boundary;
	const blocking = !showing(boundary);
	const counted = !batch.fork;
	if (counted) outstanding++;
	count(boundary, 1);
	if (blocking) {
		batch.work += 1;
		if (holder !== null) {
			const owners = (batch.owners ??= new Map());
			owners.set(holder, (owners.get(holder) ?? 0) + 1);
		}
	}
	let unsettled = true;
	const settle = (): void => {
		if (!unsettled) return;
		unsettled = false;
		holder?.units?.delete(settle);
		count(boundary, -1);
		if (blocking) {
			const target = alias(batch);
			target.work -= 1;
			const owners = target.owners;
			if (holder !== null && owners !== null) {
				const left = (owners.get(holder) ?? 1) - 1;
				if (left > 0) owners.set(holder, left);
				else owners.delete(holder);
			}
			if (!target.done && !holds(target)) request();
		}
		if (counted) released();
		else recheck();
	};
	if (!counted) speculative.add(settle);
	if (holder !== null && !holder.destroyed) (holder.units ??= new Set()).add(settle);
	return settle;
}

export function asyncDerived<T>(fn: () => T | PromiseLike<T>): Promise<Source<T>> {
	if (owner === null) asyncOrphan();
	const signal = source<T>(undefined as T);
	const latest = new Map<Batch, AsyncRun>();
	const results = new Map<Batch, Result>();
	const ranks = new WeakMap<Batch, number>();
	let resolved = false;
	let committed = 0;
	let committedRevision = 0;
	let revision = 0;
	let retained: Resumption | null = null;
	const prune = (): void => {
		if (latest.size === 0 && results.size === 0 && retained !== null) settleReads(retained);
	};
	const realOrder = (finished = false): number => {
		let order = committed;
		for (const [holder, result] of results) {
			const batch = alias(holder);
			if (batch.fork || batch.discarded || (finished && !batch.done)) continue;
			order = Math.max(order, result.order);
		}
		return order;
	};
	const rank = (given: Batch): number => {
		const batch = alias(given);
		const result = results.get(batch);
		let order = Math.max(batch.order, ranks.get(batch) ?? 0, result?.order ?? 0);
		if (result?.speculative && !batch.fork) order = Math.max(order, realOrder(true));
		return order;
	};
	const move = (from: Batch, into: Batch): void => {
		ranks.set(into, Math.max(from.order, ranks.get(from) ?? 0, rank(into)));
		const incoming = results.get(from);
		if (incoming === undefined) return;
		results.delete(from);
		const current = results.get(into);
		const newer =
			current === undefined ||
			incoming.order > current.order ||
			(incoming.order === current.order && incoming.revision > current.revision);
		const selected = newer ? incoming : current;
		results.set(into, {
			...selected,
			speculative: incoming.speculative || current?.speculative === true
		});
	};
	const finish = (holder: Batch): void => {
		const batch = alias(holder);
		const result = results.get(batch);
		if (result === undefined) return;
		results.delete(batch);
		if (!batch.discarded) {
			const order = result.speculative ? Math.max(committed, result.order) : result.order;
			if (
				result.speculative ||
				order > committed ||
				(order === committed && result.revision > committedRevision)
			) {
				committed = order;
				ranks.set(batch, Math.max(rank(batch), order));
				committedRevision = result.revision;
				retained = result.reading;
			}
		}
		prune();
	};
	const retain = (batch: Batch, reading: Resumption, order: number): void => {
		ranks.set(batch, Math.max(rank(batch), order));
		const current = results.get(batch);
		results.set(batch, {
			order,
			revision: ++revision,
			reading,
			speculative: batch.fork || current?.speculative === true
		});
		if (current !== undefined) return;
		onMerge(batch, move);
		void waitFor(batch).then(() => finish(batch));
	};
	let initial = true;
	let first!: (source: Source<T>) => void;
	let refuse!: (error: unknown) => void;
	const ready = new Promise<Source<T>>((resolve, reject) => {
		first = resolve;
		refuse = reject;
	});
	const effect: Effect = block(() => {
		const batch = current();
		const origin = sequence();
		let order = Math.max(rank(batch), realOrder(true));
		latest.get(batch)?.supersede();
		const done = initial ? null : work();
		initial = false;
		let target = batch;
		let owned = true;
		const token: AsyncRun = {
			stale() {
				return changed(run.values, run.reaction);
			},
			supersede() {
				if (!owned) return;
				owned = false;
				if (latest.get(target) === token) latest.delete(target);
				done?.();
			},
			adopt(into) {
				move(target, into);
				order = Math.max(order, rank(into));
				if (owned) {
					latest.delete(target);
					latest.set(into, token);
				}
				target = into;
			}
		};
		latest.set(batch, token);
		(batch.runs ??= new Map()).set(owner as Effect, token);
		const run: Resumption = {
			reaction: running() as Effect,
			reads: new Set(),
			values: new Map()
		};
		let promise: Promise<T>;
		try {
			promise = Promise.resolve(awaiting(run, fn));
		} catch (error) {
			promise = Promise.reject(error);
		}
		const own = (): boolean => {
			if (!owned || latest.get(target) !== token) return false;
			owned = false;
			latest.delete(target);
			const current = alias(target);
			if (effect.destroyed || current.discarded) return false;
			return current.fork || order >= realOrder(true);
		};
		promise.then(
			(value) => {
				if (own()) {
					within(batch, () => {
						const holder = alias(target);
						if (holder.fork || order >= realOrder()) write(signal, value, origin);
						else inside(holder, () => stage(holder, signal, value, origin));
						retain(current(), run, order);
					});
					resolved = true;
					first(signal);
				}
				prune();
				done?.();
			},
			(error: unknown) => {
				if (error === staleReaction) return;
				const owned = own();
				prune();
				done?.();
				if (!owned) return;
				if (resolved) within(target, () => fail(effect, error));
				else refuse(error);
			}
		);
	});
	asynchronous.add(effect);
	return ready;
}

export function pending(): number {
	if (owner === null) return pendingOutside();
	const boundary = owner.boundary;
	if (boundary === null) return 0;
	const found = tally(boundary);
	found.source ??= source(found.units);
	return get(found.source);
}
