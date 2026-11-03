import { flushSync, write } from './scheduler.ts';
import { eager } from './effects.ts';
import type { Effect, Source } from './graph.ts';
import { source } from './sources.ts';
import { get } from './reads.ts';
import { owner, present, reading } from './tracking.ts';

const versions = new WeakMap<Effect, Source<number>>();
let bumped: Source<number>[] = [];

function flush(): void {
	flushSync(() => {
		const due = bumped;
		bumped = [];
		for (const version of due) write(version, version.v + 1);
	});
}

export function latest<T>(fn: () => T): T {
	const parent = owner;
	if (parent === null || !reading()) return present(fn);
	let version = versions.get(parent);
	if (version === undefined) {
		version = source(0);
		versions.set(parent, version);
	}
	get(version);
	const due = version;
	let initial = true;
	let value = undefined as T;
	eager(() => {
		if (initial) {
			value = fn();
			return;
		}
		if (bumped.length === 0) queueMicrotask(flush);
		if (!bumped.includes(due)) bumped.push(due);
	});
	initial = false;
	return value;
}
