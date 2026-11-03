import type { Boundary, Effect, Source } from './graph.ts';

export interface Tally {
	units: number;
	source: Source<number> | null;
	queued: boolean;
	readonly effects: Effect[];
}

const tallies = new WeakMap<Boundary, Tally>();

export function tally(boundary: Boundary): Tally {
	let found = tallies.get(boundary);
	if (found === undefined) {
		found = { units: 0, source: null, queued: false, effects: [] };
		tallies.set(boundary, found);
	}
	return found;
}

export function tallied(boundary: Boundary): Tally | undefined {
	return tallies.get(boundary);
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
