import {
	BLOCK,
	CLEAN,
	DIRTY,
	EFFECT,
	MAYBE,
	TEMPLATE,
	isDerived,
	stamp,
	type Effect,
	type Source
} from './graph.ts';
import { run } from './effects.ts';
import { depthExceeded } from './errors.ts';
import { readDuringRun, recalling, stale, untrack, written } from './tracking.ts';

type Phase = 'structure' | 'commit' | 'content' | 'effects';

const limit = 1000;

class Batch {
	readonly before = new Map<Source, unknown>();
	readonly queued: Effect[] = [];
	readonly commits: (() => void)[] = [];
	readonly effects: Effect[] = [];
	phase: Phase | null = null;
	started = false;
}

let open: Batch | null = null;
let processing: Batch | null = null;
let waiting: (() => void)[] = [];

function joins(batch: Batch | null): boolean {
	return batch !== null && (batch.phase === 'structure' || batch.phase === 'commit');
}

function receiving(): Batch {
	if (joins(processing)) return processing as Batch;
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

export function collect(effect: Effect): void {
	if (joins(processing)) (processing as Batch).effects.push(effect);
	else schedule(effect);
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
	const batch = receiving();
	if (!batch.before.has(source)) batch.before.set(source, source.v);
	source.v = value;
	source.wv = stamp();
	written(source);
	readDuringRun(source);
	mark(source, DIRTY);
	return value;
}

export function retire(teardown: () => void): void {
	const batch = processing ?? open;
	if (batch === null) {
		untrack(teardown);
		return;
	}
	const later = open !== null && open !== batch ? open.before : null;
	recalling(batch.before, later, teardown);
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

function traverse(effect: Effect, content: Effect[], effects: Effect[]): void {
	effect.pending = false;
	for (let child = effect.first; child !== null; child = child.next) {
		if (child.destroyed || child.inert) continue;
		switch (child.kind) {
			case BLOCK:
				if (child.status !== CLEAN && stale(child)) run(child);
				break;
			case TEMPLATE:
				if (child.status !== CLEAN) content.push(child);
				break;
			case EFFECT:
				if (child.status !== CLEAN) effects.push(child);
				break;
		}
		if (child.pending) traverse(child, content, effects);
	}
}

function settle(effects: readonly Effect[]): void {
	for (let index = 0; index < effects.length; index++) {
		const effect = effects[index] as Effect;
		if (effect.destroyed || effect.inert || effect.running) continue;
		if (stale(effect)) run(effect);
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
			if (++passes > limit) depthExceeded();
			batch.phase = 'structure';
			for (const root of resolve(batch)) traverse(root, content, batch.effects);
			batch.phase = 'commit';
			for (const apply of batch.commits.splice(0)) apply();
		}
		batch.phase = 'content';
		settle(content);
		batch.phase = 'effects';
		settle(batch.effects);
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
	if (!joins(processing)) {
		let rounds = 0;
		while (open !== null) {
			if (++rounds > limit) depthExceeded();
			const batch = open;
			open = null;
			process(batch);
		}
		if (processing === null && waiting.length > 0) {
			const resolved = waiting;
			waiting = [];
			for (const done of resolved) done();
		}
	}
	return result as T;
}

export function settled(): Promise<void> {
	receiving();
	return new Promise((done) => waiting.push(done));
}

export function tick(): Promise<void> {
	return new Promise((done) => {
		if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => done());
		setTimeout(done, 0);
	});
}
