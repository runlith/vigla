import { createBatch, open, processing, untouched, within } from './batch.ts';
import { apply, flushSync, process } from './scheduler.ts';
import { inside } from './views.ts';
import { useDrafts } from './drafting.ts';
import { adopt, useHolding, waitFor } from './holding.ts';
import { destroy, teardown } from './effects.ts';
import { forkDiscarded, forkTiming } from './errors.ts';
import { application, isDestroyed, type Effect } from './graph.ts';
import { discard } from './held.ts';
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
	useDrafts();
	useHolding();
	const holder = owner;
	if (!admits(holder)) forkTiming();
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
	if (holder !== null && isDestroyed(holder)) discard(batch);
	else if (holder !== null && !batch.done) {
		const ending = teardown(() => {
			if (!committing) discard(batch);
		});
		void committed.then(() => destroy(ending));
	}
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
