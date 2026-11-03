import { DEV } from 'esm-env';
import { processed, revisit, type Batch } from './batch.ts';
import { swapCollector } from './collector.ts';
import { add, depsOf, extend, rebuild, retainDeps, truncate, unsubscribe } from './edges.ts';
import { unsafeMutation } from './errors.ts';
import {
	BLOCK,
	CLEAN,
	DERIVED,
	DIRTY,
	EAGER,
	asynchronous,
	isDerived,
	now,
	type Derived,
	type Effect,
	type Reaction,
	type Source
} from './graph.ts';
import type { Prior } from './history.ts';
import { localLeaving, withoutLeaving } from './outgoing.ts';
import { computed, tracedRun, tracing } from './provenance.ts';

interface Frame {
	target: Reaction | null;
	started: number;
	version: number;
	old: Source[] | null;
	matched: number;
	extra: Source[] | null;
	marks: number;
	invalidated: boolean;
	hidden: Set<Batch> | null;
	local: Set<Source> | null;
	keep: boolean;
	run: Resumption | null;
	captured: Map<Source, unknown> | null;
}

export interface Resumption {
	readonly reaction: Reaction;
	readonly reads: Set<Source>;
	readonly values: Map<Source, unknown>;
	ended: boolean;
}

export interface View {
	readonly batch: Batch;
	readonly values: Map<Source, unknown>;
	readonly hidden: Map<Source, Batch>;
	readonly checked: Map<Derived, boolean>;
	readonly reached: Map<Derived, Set<Batch>>;
}

export interface Past {
	readonly before: Prior;
	readonly later: Prior | null;
	written: Set<Source> | null;
	derived: Map<Derived, unknown> | null;
}

let versions = 0;
let depth = 0;
let floor = 0;
let marks = 0;

let frame: Frame | null = null;
let late: Frame | null = null;
let resumption: Resumption | null = null;
let awaited: Resumption | null = null;
let executing: Reaction | null = null;
let evaluating: object | null = null;
const frames: Frame[] = [];
let hiddenByLast: Set<Batch> | null = null;

export let view: View | null = null;
export let past: Past | null = null;
export let lost: Resumption | null = null;
export let owner: Effect | null = null;

export function marked(): void {
	marks++;
}

export function setOwner(effect: Effect | null): Effect | null {
	const previous = owner;
	owner = effect;
	return previous;
}

export function setView(next: View | null): View | null {
	const previous = view;
	view = next;
	return previous;
}

export function setPast(next: Past | null): Past | null {
	const previous = past;
	past = next;
	return previous;
}

export function setLost(next: Resumption | null): void {
	lost = next;
}

function opened(target: Reaction): Frame {
	let current = frames[depth];
	if (current === undefined) {
		current = {
			target: null,
			started: 0,
			version: 0,
			old: null,
			matched: 0,
			extra: null,
			marks: 0,
			invalidated: false,
			hidden: null,
			local: null,
			keep: false,
			run: null,
			captured: null
		};
		frames.push(current);
	}
	current.target = target;
	if (DEV) current.started = now();
	current.version = versions += 3;
	current.old = target.deps;
	current.matched = 0;
	current.extra = null;
	current.marks = marks;
	current.invalidated = false;
	current.hidden = null;
	current.local = null;
	current.keep = false;
	depth++;
	frame = current;
	return current;
}

function closed(previous: Frame | null): void {
	depth--;
	(frames[depth] as Frame).target = null;
	frame = previous;
}

function finished(current: Frame): void {
	current.captured = null;
	current.old = current.extra = null;
	current.hidden = null;
	current.local = null;
}

function top(): Frame | null {
	return depth === floor ? null : (frames[depth - 1] as Frame);
}

function kindOf(at: Frame): number {
	return (at.target as Effect | Derived).kind;
}

export function deriving(): Derived | null {
	const at = frame ?? top();
	return at !== null && kindOf(at) === DERIVED ? (at.target as Derived) : null;
}

export function localize(source: Source): void {
	const at = top();
	if (at !== null && kindOf(at) === DERIVED) {
		(at.local ??= new Set()).add(source);
		localLeaving(source, at.target as Reaction);
	}
}

export function local(source: Source): boolean {
	const at = top();
	return at !== null && at.local !== null && at.local.has(source);
}

export function guard(source: Source): void {
	const at = frame ?? top();
	if (at === null) return;
	const kind = kindOf(at);
	if (kind !== EAGER && (frame === null || (kind !== DERIVED && kind !== BLOCK))) return;
	if (at.local === null || !at.local.has(source)) unsafeMutation();
}

function record(at: Frame, source: Source): void {
	source.read = at.version;
	const old = at.old;
	if (at.extra === null && old !== null && at.matched < old.length && old[at.matched] === source)
		at.matched++;
	else if (at === late) adopt(at.run as Resumption, source);
	else (at.extra ??= []).push(source);
}

function adopt(run: Resumption, source: Source): void {
	run.reads.add(source);
	add(run.reaction, source);
}

export function depend(source: Source): void {
	const at = frame;
	if (DEV && tracing !== null) tracing.traced(source, at?.target ?? null);
	if (at !== null && source.read !== at.version && (at.local === null || !at.local.has(source)))
		record(at, source);
}

export function capture(source: Source, value: unknown): void {
	const at = frame;
	if (view !== null && at !== null) (at.captured ??= new Map()).set(source, value);
	const run = at === late ? late?.run : awaited;
	if (run !== null && run !== undefined && at?.target === run.reaction)
		run.values.set(source, value);
}

function retain(target: Reaction, current: Frame): void {
	const reads = current.captured;
	if (reads === null) {
		target.captured = null;
		return;
	}
	target.captured = { values: reads, viewed: view !== null };
	const effect = target as Effect;
	if (effect.kind !== BLOCK || asynchronous.has(effect)) return;
	const batch = view?.batch ?? processed();
	if (batch !== null && (batch.after !== null || batch.work > 0 || batch.fork))
		(batch.reads ??= new Map()).set(effect, reads);
}

export function observedReads(target: Reaction): ReadonlyMap<Source, unknown> | undefined {
	return target.captured?.values;
}

export function viewedReads(target: Reaction): ReadonlyMap<Source, unknown> | undefined {
	const captured = target.captured;
	return captured !== null && captured.viewed ? captured.values : undefined;
}

export function settleReads(run: Resumption): void {
	if (run.reaction.deps === null || (run.reaction as Effect).destroyed === true) return;
	retainDeps(run.reaction, run.reads);
}

function readBy(at: Frame, source: Source): boolean {
	if (source.read === at.version) return true;
	const old = at.old;
	if (old !== null)
		for (let index = 0; index < at.matched; index++) if (old[index] === source) return true;
	return at.extra !== null && at.extra.includes(source);
}

function reads(at: Frame): Source[] {
	const found = at.old === null ? [] : at.old.slice(0, at.matched);
	if (at.extra !== null) found.push(...at.extra);
	return found;
}

export function reading(): boolean {
	return frame !== null;
}

export function running(): Reaction | null {
	return executing;
}

export function resuming(): Resumption | null {
	return executing === null ? resumption : null;
}

export function evaluation(): object | null {
	if (executing === null) return resumption;
	if (evaluating !== null) return evaluating;
	return awaited !== null && executing === awaited.reaction ? awaited : executing;
}

export function withoutReaction<T>(fn: () => T): T {
	const previous = executing;
	const previousFloor = floor;
	const previousResumption = resumption;
	executing = null;
	floor = depth;
	resumption = null;
	try {
		return untrack(fn);
	} finally {
		executing = previous;
		floor = previousFloor;
		resumption = previousResumption;
	}
}

export function untrack<T>(fn: () => T): T {
	const previous = frame;
	const collecting = swapCollector(null);
	const paused = DEV ? lost : null;
	if (DEV) lost = null;
	frame = null;
	try {
		return fn();
	} finally {
		frame = previous;
		swapCollector(collecting);
		if (DEV) lost = paused;
	}
}

export function asyncRun(): Resumption | null {
	return awaited !== null && executing === awaited.reaction ? awaited : null;
}

export function awaiting<T>(run: Resumption, fn: () => T): T {
	const previous = awaited;
	awaited = run;
	try {
		return fn();
	} finally {
		awaited = previous;
		const at = frame;
		if (at !== null && at.target === run.reaction) {
			at.keep = true;
			for (const source of reads(at)) run.reads.add(source);
		}
	}
}

export function suspendReading(): Resumption | null {
	if (late !== null && frame === late) return late.run;
	if (late === null && executing === null) return resumption;
	return awaited !== null && executing === awaited.reaction ? awaited : null;
}

export function resumeReading(run: Resumption | null, discarded: boolean): void {
	endReading();
	if (run === null) return;
	if (discarded) run.ended = true;
	resumption = run;
	if (frame !== null || (run.reaction as Effect).destroyed === true) return;
	late = {
		target: run.reaction,
		started: 0,
		version: (versions += 3),
		old: null,
		matched: 0,
		extra: null,
		marks,
		invalidated: false,
		hidden: null,
		local: null,
		keep: false,
		run,
		captured: null
	};
	frame = late;
}

export function endReading(): void {
	resumption = null;
	if (late === null) return;
	if (frame === late) frame = null;
	late = null;
}

export function note(hidden: Iterable<Batch>): void {
	if (frame === null) return;
	for (const batch of hidden) (frame.hidden ??= new Set()).add(batch);
}

export function compute(derived: Derived, given: View): unknown {
	const previous = frame;
	const previousReaction = executing;
	const previousEvaluation = evaluating;
	executing = derived;
	evaluating = null;
	const current = opened(derived);
	const previousOwner = setOwner(derived.owner);
	try {
		const value = derived.fn();
		if (DEV) computed(derived, value, given.batch);
		return value;
	} finally {
		if (DEV) tracedRun(derived, now());
		closed(previous);
		executing = previousReaction;
		evaluating = previousEvaluation;
		setOwner(previousOwner);
		const extra = current.extra ?? [];
		if (depsOf(derived).length === 0 && extra.length > 0) own(derived);
		for (const dep of extra) add(derived, dep);
		if (current.hidden !== null) {
			given.reached.set(derived, current.hidden);
			note(current.hidden);
		}
		finished(current);
	}
}

export function conceal(source: Source, value: unknown, batch: Batch): void {
	if (view === null || view.values.has(source)) return;
	view.values.set(source, value);
	view.hidden.set(source, batch);
}

export function present<T>(fn: () => T): T {
	const previousPast = setPast(null);
	const previousView = view;
	view = null;
	try {
		return withoutLeaving(fn);
	} finally {
		setPast(previousPast);
		view = previousView;
	}
}

export function readDuringRun(source: Source): void {
	const read = source.read;
	if (depth === 0 || read < (frames[0] as Frame).version) return;
	for (let index = depth - 1; index >= 0; index--) {
		const current = frames[index] as Frame;
		if (current.version <= read && !current.invalidated && readBy(current, source))
			current.invalidated = true;
	}
}

function own(derived: Derived): void {
	const holder = derived.owner;
	if (holder !== null) (holder.owned ??= []).push(derived);
}

function reconcile(target: Reaction, current: Frame, keep: boolean): void {
	const previous = target.deps;
	const old = current.old;
	const extra = current.extra;
	const matched = current.matched;
	if (old === previous && extra === null) {
		if (old === null) depsOf(target);
		else if (!keep && matched < old.length) truncate(target, matched);
		return;
	}
	if (old === previous && extra !== null) {
		const empty = old === null || old.length === 0;
		const count = extend(target, matched, extra, keep, current.version);
		if (empty && count > 0 && isDerived(target)) own(target);
		return;
	}
	const kept = new Set(reads(current));
	rebuild(target, kept, keep);
	if ((previous === null || previous.length === 0) && kept.size > 0 && isDerived(target))
		own(target);
}

function dirtyRead(dep: Source): boolean {
	return isDerived(dep) && dep.status !== CLEAN && (view === null || !view.values.has(dep));
}

export function track<T>(target: Reaction, fn: () => T, isolated = false): T {
	const previous = frame;
	const previousReaction = executing;
	const previousEvaluation = evaluating;
	executing = target;
	evaluating = isolated ? {} : null;
	const current = opened(target);
	try {
		return fn();
	} finally {
		closed(previous);
		executing = previousReaction;
		evaluating = previousEvaluation;
		if (!isolated) {
			hiddenByLast = current.hidden;
			if ((target as Effect).destroyed === true) unsubscribe(target);
			else settleRun(target, current);
			if (DEV) tracedRun(target, target.status === DIRTY ? current.started : now());
		}
		finished(current);
	}
}

function settleRun(target: Reaction, current: Frame): void {
	let invalidated = current.invalidated;
	if (!invalidated && (view !== null || marks !== current.marks)) {
		const old = current.old;
		if (old !== null)
			for (let index = 0; !invalidated && index < current.matched; index++)
				if (dirtyRead(old[index] as Source)) invalidated = true;
		if (!invalidated && current.extra !== null)
			for (const dep of current.extra) if (dirtyRead(dep)) invalidated = true;
	}
	reconcile(
		target,
		current,
		current.keep || (view !== null && (view.batch.fork || current.hidden !== null))
	);
	retain(target, current);
	target.rv = now();
	target.status = invalidated ? DIRTY : CLEAN;
}

export function validate<T>(target: Reaction, fn: () => T): T {
	const previous = frame;
	const current = opened(target);
	try {
		return fn();
	} finally {
		closed(previous);
		if (!isDerived(target)) revisit(target as Effect, current.hidden);
		finished(current);
	}
}

export function takeHidden(): Set<Batch> | null {
	const found = hiddenByLast;
	hiddenByLast = null;
	return found;
}
