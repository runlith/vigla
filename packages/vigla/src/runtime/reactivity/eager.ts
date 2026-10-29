import { run } from './effects.ts';
import type { Effect } from './graph.ts';
import { present, stale } from './tracking.ts';

const queued = new Set<Effect>();
let running = false;

export function queueEager(effect: Effect): void {
	queued.add(effect);
}

export function runEager(): void {
	if (queued.size === 0 || running) return;
	running = true;
	try {
		present(() => {
			for (const effect of queued) {
				queued.delete(effect);
				if (!effect.destroyed && stale(effect)) run(effect);
			}
		});
	} finally {
		running = false;
	}
}
