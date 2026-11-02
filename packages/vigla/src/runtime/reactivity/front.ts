import { locateFront } from '../../shared/diagnostics.ts';
import type { Format } from '../../shared/format.ts';
import { ambient } from './carried.ts';
import type { Effect } from './graph.ts';

const fronts = new WeakMap<Effect, Format>();

export function setFront(tree: Effect, front: Format): void {
	fronts.set(tree, front);
}

export function frontOf(effect: Effect | null): Format | null {
	for (let at = effect; at !== null; at = at.parent) {
		const front = fronts.get(at);
		if (front !== undefined) return front;
	}
	return null;
}

locateFront(() => frontOf(ambient()));
