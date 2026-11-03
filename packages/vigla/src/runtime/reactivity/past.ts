import { active, open, processing } from './batch.ts';
import type { Source } from './graph.ts';
import { earlier, prior, type Prior } from './history.ts';
import { withoutLeaving } from './outgoing.ts';
import { past, setPast, withoutReaction } from './tracking.ts';

let instant = false;

export function instantly(fn: () => void): void {
	const outer = instant;
	instant = true;
	try {
		fn();
	} finally {
		instant = outer;
	}
}

export function retire(teardown: () => void): void {
	const batch = active ?? processing ?? open;
	if (batch === null || instant) {
		withoutReaction(() => teardown.call(null));
		return;
	}
	const later = open !== null && open !== batch ? prior(open) : null;
	recalling(earlier(batch), later, teardown);
}

export function recalling(before: Prior, later: Prior | null, fn: () => void): void {
	const previous = setPast({ before, later, written: null, derived: null });
	try {
		withoutReaction(() => fn.call(null));
	} finally {
		setPast(previous);
	}
}

export function presently(fn: () => void): void {
	const previous = setPast(null);
	try {
		withoutLeaving(fn);
	} finally {
		setPast(previous);
	}
}

export function written(source: Source): void {
	if (past === null) return;
	(past.written ??= new Set()).add(source);
	past.derived = null;
}
