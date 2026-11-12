import { run } from './effects.ts';
import { isDestroyed, type Effect } from './graph.ts';
import { stale } from './reads.ts';
import { present } from './tracking.ts';

const queued = new Set<Effect>();
let running = false;
let held = 0;

export function queueEager(effect: Effect): void {
	queued.add(effect);
}

export function holdEager<T>(fn: () => T): T {
	held++;
	try {
		return fn();
	} finally {
		held--;
		runEager();
	}
}

function due(effect: Effect): boolean {
	try {
		return stale(effect);
	} catch {
		return true;
	}
}

export function runEager(): void {
	if (queued.size === 0 || running || held > 0) return;
	running = true;
	try {
		present(() => {
			for (const effect of queued) {
				queued.delete(effect);
				if (!isDestroyed(effect) && due(effect)) run(effect);
			}
		});
	} finally {
		running = false;
	}
}
