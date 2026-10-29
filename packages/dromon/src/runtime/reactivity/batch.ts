import {
	BLOCK,
	BRANCH,
	CLEAN,
	DIRTY,
	MAYBE,
	ROOT,
	TEMPLATE,
	isDerived,
	tick,
	type Effect,
	type Source
} from './graph.ts';
import { run } from './effects.ts';
import { readDuringRun, stale } from './tracking.ts';

type Phase = 'structure' | 'commit' | 'content';

const limit = 1000;

class Batch {
	readonly queued: Effect[] = [];
	readonly commits: (() => void)[] = [];
	phase: Phase | null = null;
	started = false;
}

let open: Batch | null = null;
let processing: Batch | null = null;

function receiving(): Batch {
	if (processing !== null && processing.phase !== 'content') return processing;
	if (open === null) {
		const batch = new Batch();
		open = batch;
		queueMicrotask(() => {
			if (!batch.started) flushSync();
		});
	}
	return open;
}

export function schedule(effect: Effect): void {
	receiving().queued.push(effect);
}

function mark(source: Source, status: typeof DIRTY | typeof MAYBE): void {
	const reactions = source.reactions;
	if (reactions === null) return;
	for (const reaction of reactions) {
		const previous = reaction.status;
		if (previous < status) reaction.status = status;
		if (previous !== CLEAN) continue;
		if (isDerived(reaction)) mark(reaction, MAYBE);
		else schedule(reaction as Effect);
	}
}

export function write<T>(source: Source<T>, value: T): T {
	if (Object.is(source.v, value)) return value;
	source.v = value;
	source.wv = tick();
	readDuringRun(source);
	mark(source, DIRTY);
	return value;
}

export function atCommit(apply: () => void): void {
	if (processing === null || processing.phase !== 'structure') apply();
	else processing.commits.push(apply);
}

function resolve(batch: Batch): Effect[] {
	const roots = new Set<Effect>();
	for (const effect of batch.queued.splice(0)) {
		if (effect.destroyed || effect.status === CLEAN) continue;
		let top = effect;
		let covered = false;
		while (top.parent !== null) {
			top = top.parent;
			if (top.pending) {
				covered = true;
				break;
			}
			top.pending = true;
		}
		if (!covered) roots.add(top);
	}
	return [...roots].sort((a, b) => a.order - b.order);
}

function traverse(effect: Effect, content: Effect[]): void {
	effect.pending = false;
	for (let child = effect.first; child !== null; child = child.next) {
		if (child.destroyed || child.inert) continue;
		switch (child.kind) {
			case BLOCK:
				if (child.status !== CLEAN && stale(child)) run(child);
				if (child.pending) traverse(child, content);
				break;
			case TEMPLATE:
				if (child.status !== CLEAN) content.push(child);
				break;
			case BRANCH:
			case ROOT:
				if (child.pending) traverse(child, content);
				break;
		}
	}
}

function process(batch: Batch): void {
	const outer = processing;
	processing = batch;
	batch.started = true;
	try {
		const content: Effect[] = [];
		let passes = 0;
		while (batch.queued.length > 0) {
			if (++passes > limit) throw new Error('Maximum update depth exceeded');
			batch.phase = 'structure';
			for (const root of resolve(batch)) traverse(root, content);
			batch.phase = 'commit';
			for (const apply of batch.commits.splice(0)) apply();
		}
		batch.phase = 'content';
		for (const effect of content) {
			if (effect.destroyed || effect.inert || effect.running) continue;
			if (stale(effect)) run(effect);
		}
	} finally {
		batch.phase = null;
		processing = outer;
	}
}

export function flushSync<T = void>(fn?: () => T): T {
	let result: T | undefined;
	if (fn !== undefined) {
		flushSync();
		result = fn();
	}
	if (processing === null || processing.phase === 'content') {
		let rounds = 0;
		while (open !== null) {
			if (++rounds > limit) throw new Error('Maximum update depth exceeded');
			const batch = open;
			open = null;
			process(batch);
		}
	}
	return result as T;
}
