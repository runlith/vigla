import { alias, collect, current, holds, onMerge, request, within, type Batch } from './batch.ts';
import { stage, write } from './scheduler.ts';
import { inside } from './views.ts';
import { staleReaction } from '../../shared/abort.ts';
import { useDrafts } from './drafting.ts';
import { block, fail } from './effects.ts';
import { sequence } from './history.ts';
import { changed, get } from './reads.ts';
import { useHolding, waitFor } from './holding.ts';
import { asyncOrphan, pendingOutside } from './errors.ts';
import { ASYNC, isDestroyed, type Boundary, type Effect, type Source } from './graph.ts';
import { source } from './sources.ts';
import { showing, tallied, tally } from './tallies.ts';
import { begin, dropUnit, exempt, holdUnit, recheck, released } from './units.ts';
import { awaiting, owner, running, settleReads, type Resumption } from './tracking.ts';

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

export function reveal(boundary: Boundary): void {
	const found = tallied(boundary);
	if (found === undefined) return;
	for (const effect of found.effects.splice(0)) if (!isDestroyed(effect)) collect(effect);
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

export async function hold<T>(fn: () => T): Promise<Awaited<T>> {
	const finish = work();
	try {
		return await fn();
	} finally {
		finish();
	}
}

export function work(): () => void {
	useDrafts();
	useHolding();
	const batch = current();
	const holder = owner;
	const boundary = holder === null ? null : holder.boundary;
	const blocking = !showing(boundary);
	const counted = !batch.fork;
	if (counted) begin();
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
		dropUnit(holder, settle);
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
	if (!counted) exempt(settle);
	holdUnit(holder, settle);
	return settle;
}

export function asyncDerived<T>(fn: () => T | PromiseLike<T>): Promise<Source<T>> {
	if (owner === null) asyncOrphan();
	useDrafts();
	useHolding();
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
				if (owned && !alias(target).fork && order < realOrder(true)) return true;
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
			values: new Map(),
			ended: false
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
			if (isDestroyed(effect) || current.discarded) return false;
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
				if (error === staleReaction && !alias(target).discarded) return;
				const owned = own();
				prune();
				done?.();
				if (!owned) return;
				if (resolved) within(target, () => fail(effect, error));
				else refuse(error);
			}
		);
	});
	effect.flags |= ASYNC;
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
