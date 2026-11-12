import { active, open, processing } from './batch.ts';
import type { Effect, Source } from './graph.ts';
import { earlier, prior, type History } from './history.ts';
import { withoutLeaving } from './outgoing.ts';
import { past, setPast, withoutReaction } from './tracking.ts';

let instant = false;
let retiring = 0;

export function tearingDown(): boolean {
	return retiring !== 0;
}

export function instantly(fn: () => void): void {
	const outer = instant;
	instant = true;
	try {
		fn();
	} finally {
		instant = outer;
	}
}

export function retire(reader: Effect, teardown: () => void): void {
	const batch = active ?? processing ?? open;
	retiring++;
	try {
		if (batch === null || instant) withoutReaction(() => teardown.call(null));
		else recalling(batch, reader, teardown);
	} finally {
		retiring--;
	}
}

function recalling(home: History, reader: Effect, fn: () => void): void {
	const previous = setPast({
		before: earlier(home),
		later: open !== null && open !== home ? prior(open) : null,
		home,
		reader,
		written: null,
		derived: null
	});
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
	(past.home.retired ??= new Set()).add(source);
	past.derived = null;
}
