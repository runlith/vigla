import { createBatch, open, processing, untouched, within } from './batch.ts';
import { apply, flushSync, process } from './scheduler.ts';
import { inside } from './views.ts';
import { forkDiscarded, forkTiming } from './errors.ts';
import { application, type Effect } from './graph.ts';
import { adopt, discard, waitFor } from './held.ts';
import { owner } from './tracking.ts';

export interface Fork {
	commit(): Promise<void>;
	discard(): void;
}

function admits(caller: Effect | null): boolean {
	if (processing !== null) return false;
	if (open === null) return true;
	if (caller === null) return false;
	const mine = application(caller);
	for (const effect of open.queued) if (application(effect) === mine) return false;
	return true;
}

export function fork(fn: () => void): Fork {
	if (!admits(owner)) forkTiming();
	flushSync();
	const batch = createBatch();
	batch.fork = true;
	batch.after = new Map();
	adopt(batch);
	inside(batch, fn);
	process(batch);
	untouched(batch);
	const committed = waitFor(batch);
	let committing = false;
	return {
		async commit() {
			if (!committing) {
				if (batch.done) forkDiscarded();
				committing = true;
				adopt(batch);
				batch.fork = false;
				within(batch, () => apply(batch));
				flushSync();
			}
			await committed;
		},
		discard() {
			if (!committing) discard(batch);
		}
	};
}
