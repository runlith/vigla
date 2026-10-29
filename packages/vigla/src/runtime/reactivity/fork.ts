import { Batch, apply, flushSync, inside, process, quiet, within } from './batch.ts';
import { forkDiscarded, forkTiming } from './errors.ts';
import { adopt, discard, waitFor } from './held.ts';

export interface Fork {
	commit(): Promise<void>;
	discard(): void;
}

export function fork(fn: () => void): Fork {
	if (!quiet()) forkTiming();
	flushSync();
	const batch = new Batch();
	batch.fork = true;
	batch.after = new Map();
	adopt(batch);
	inside(batch, fn);
	process(batch);
	const committed = waitFor(batch);
	let committing = false;
	return {
		async commit() {
			if (!committing) {
				if (batch.done) forkDiscarded();
				committing = true;
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
