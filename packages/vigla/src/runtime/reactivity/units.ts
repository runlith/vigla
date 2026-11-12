import { current, open, pending, processing } from './batch.ts';
import { ambient } from './carried.ts';
import { UNITS, application, isDestroyed, type Effect } from './graph.ts';
import { owner } from './tracking.ts';

let outstanding = 0;
const watchers = new Set<() => void>();
const speculative = new WeakSet<() => void>();
const held = new WeakMap<Effect, Set<() => void>>();
let drains: (() => void)[] = [];
let waiting: (() => void)[] = [];

export function holdUnit(holder: Effect | null, settle: () => void): void {
	if (holder === null || isDestroyed(holder)) return;
	let found = held.get(holder);
	if (found === undefined) {
		held.set(holder, (found = new Set()));
		holder.flags |= UNITS;
	}
	found.add(settle);
}

export function dropUnit(holder: Effect | null, settle: () => void): void {
	if (holder !== null && (holder.flags & UNITS) !== 0) held.get(holder)?.delete(settle);
}

export function endUnits(effect: Effect): void {
	if ((effect.flags & UNITS) === 0) return;
	effect.flags &= ~UNITS;
	const found = held.get(effect);
	held.delete(effect);
	for (const settle of found ?? []) settle();
}

export function unsettled(): boolean {
	return outstanding > 0;
}

export function begin(): void {
	outstanding++;
}

export function exempt(settle: () => void): void {
	speculative.add(settle);
}

export function released(): void {
	if (--outstanding === 0) {
		quieted();
		const resolved = drains;
		drains = [];
		for (const done of resolved) done();
	}
	recheck();
}

export function recheck(): void {
	if (watchers.size === 0) return;
	for (const check of [...watchers]) check();
}

function busy(effect: Effect): boolean {
	if (isDestroyed(effect)) return false;
	if ((effect.flags & UNITS) !== 0)
		for (const settle of held.get(effect) ?? []) if (!speculative.has(settle)) return true;
	for (let child = effect.first; child !== null; child = child.next) if (busy(child)) return true;
	return false;
}

export function unit(holder: Effect | null): () => void {
	outstanding++;
	let open = true;
	const settle = (): void => {
		if (!open) return;
		open = false;
		dropUnit(holder, settle);
		released();
	};
	holdUnit(holder, settle);
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

function idle(): boolean {
	if (open !== null || processing !== null) return false;
	for (const batch of pending) if (!batch.fork) return false;
	return true;
}

export function quieted(): void {
	if (!idle() || waiting.length === 0 || unsettled()) return;
	const resolved = waiting;
	waiting = [];
	for (const done of resolved) done();
}

export function settled(): Promise<void> {
	current();
	if (owner !== null) return settledUnder(application(owner));
	return new Promise((done) => waiting.push(done));
}
