import { ROOT, type Effect, type Reaction, type Source } from './graph.ts';
import type { LeavingView } from './leaving.ts';

export let outgoing: LeavingView | null = null;
export let leavingCount = 0;
export let selecting = true;

export function withoutLeaving<T>(fn: () => T): T {
	const previous = outgoing;
	const allowed = selecting;
	outgoing = null;
	selecting = false;
	try {
		return fn();
	} finally {
		outgoing = previous;
		selecting = allowed;
	}
}

export function setOutgoing(next: LeavingView | null): LeavingView | null {
	const previous = outgoing;
	outgoing = next;
	return previous;
}

export function countLeaving(delta: 1 | -1): void {
	leavingCount += delta;
}

export function localLeaving(source: Source, reaction: Reaction): void {
	outgoing?.locals.set(source, reaction);
}

export function ownLeaving(effect: Effect): boolean {
	const given = outgoing;
	if (given === null || given.cache === null || effect.kind === ROOT) return false;
	(given.cache.effects ??= []).push(effect);
	(given.effects ??= new Set()).add(effect);
	return true;
}
