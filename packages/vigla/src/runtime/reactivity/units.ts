import { current, open, pending, processing } from './batch.ts';
import { ambient } from './carried.ts';
import { application, type Effect } from './graph.ts';
import { owner } from './tracking.ts';

let outstanding = 0;
const watchers = new Set<() => void>();
const speculative = new WeakSet<() => void>();
let drains: (() => void)[] = [];
let waiting: (() => void)[] = [];

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
