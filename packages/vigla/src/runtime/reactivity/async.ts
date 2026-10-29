import { alias, collect, current, holds, request, within, write, type Batch } from './batch.ts';
import { block, fail } from './effects.ts';
import { asyncOrphan, pendingOutside } from './errors.ts';
import type { Boundary, Effect, Source } from './graph.ts';
import { source } from './sources.ts';
import { get, owner } from './tracking.ts';

interface Tally {
	units: number;
	source: Source<number> | null;
	queued: boolean;
	readonly effects: Effect[];
}

const tallies = new WeakMap<Boundary, Tally>();

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

export function work(): () => void {
	const batch = current();
	const holder = owner;
	const boundary = holder === null ? null : holder.boundary;
	const blocking = !showing(boundary);
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
		if (!blocking) return;
		const target = alias(batch);
		target.work -= 1;
		const owners = target.owners;
		if (holder !== null && owners !== null) {
			const left = (owners.get(holder) ?? 1) - 1;
			if (left > 0) owners.set(holder, left);
			else owners.delete(holder);
		}
		if (!target.done && !holds(target)) request();
	};
	if (holder !== null && !holder.destroyed) (holder.units ??= new Set()).add(settle);
	return settle;
}

export function asyncDerived<T>(fn: () => T | PromiseLike<T>): Promise<Source<T>> {
	if (owner === null) asyncOrphan();
	const signal = source<T>(undefined as T);
	const latest = new Map<Batch, object>();
	let resolved = false;
	let initial = true;
	let first!: (source: Source<T>) => void;
	let refuse!: (error: unknown) => void;
	const ready = new Promise<Source<T>>((resolve, reject) => {
		first = resolve;
		refuse = reject;
	});
	const effect: Effect = block(() => {
		const batch = current();
		const token = {};
		latest.set(batch, token);
		const done = initial ? null : work();
		initial = false;
		let promise: Promise<T>;
		try {
			promise = Promise.resolve(fn());
		} catch (error) {
			promise = Promise.reject(error);
		}
		const own = (): boolean => {
			if (latest.get(batch) !== token) return false;
			latest.delete(batch);
			return !effect.destroyed && !alias(batch).discarded;
		};
		promise.then(
			(value) => {
				if (own()) {
					within(batch, () => write(signal, value));
					resolved = true;
					first(signal);
				}
				done?.();
			},
			(error: unknown) => {
				const owned = own();
				done?.();
				if (!owned) return;
				if (resolved) fail(effect, error);
				else refuse(error);
			}
		);
	});
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
