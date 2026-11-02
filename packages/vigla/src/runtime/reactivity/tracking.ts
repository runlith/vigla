import { DEV } from 'esm-env';
import { revisit, type Batch } from './batch.ts';
import { computed, traced, tracedRun, tracing } from './trace.ts';
import { unsafeMutation } from './errors.ts';
import { capture, clear as clearReads, retain } from './reads.ts';
export { stale } from './reads.ts';
import { enter, leave, refresh } from './deriveds.ts';
import { destroy, freeze, thaw } from './effects.ts';
import { past, recall, setPast } from './past.ts';
import { lose, lost, pauseLoss, resumeLoss } from './loss.ts';
import {
	leavingCount,
	leavingView,
	localLeaving,
	outgoing,
	ownLeaving,
	readLeaving,
	selecting,
	withoutLeaving
} from './leaving.ts';
import {
	BLOCK,
	CLEAN,
	DERIVED,
	DIRTY,
	EAGER,
	ROOT,
	isDerived,
	now,
	stamp,
	type Derived,
	type Effect,
	type Reaction,
	type Source
} from './graph.ts';

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
}

export interface Resumption {
	readonly reaction: Reaction;
	readonly reads: Set<Source>;
	readonly values: Map<Source, unknown>;
}

let versions = 0;
let depth = 0;
let floor = 0;
let marks = 0;

export function marked(): void {
	marks++;
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
			run: null
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
	clearReads(current);
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

export function ownEffect(effect: Effect): void {
	const at = frame ?? top();
	if (at === null || kindOf(at) !== DERIVED || effect.kind === ROOT) return;
	const derived = at.target as Derived;
	if (effect.parent === derived.owner && !ownLeaving(effect)) (derived.effects ??= []).push(effect);
}

export function destroyEffects(derived: Derived): void {
	const effects = derived.effects;
	if (effects === null) return;
	derived.effects = derived.frozen = null;
	for (const effect of effects) destroy(effect);
}

function subscribe(dep: Source, reaction: Reaction): void {
	const reactions = dep.reactions;
	if (reactions !== null) {
		reactions.push(reaction);
		return;
	}
	dep.reactions = [reaction];
	if (isDerived(dep) && dep.frozen !== null) thaw(dep);
}

export function unsubscribe(dep: Source, reaction: Reaction): void {
	const reactions = dep.reactions;
	if (reactions === null) return;
	const index = reactions.indexOf(reaction);
	if (index === -1) return;
	const last = reactions.length - 1;
	if (last > 0) {
		reactions[index] = reactions[last] as Reaction;
		reactions.pop();
		return;
	}
	dep.reactions = null;
	if (isDerived(dep) && dep.effects !== null) freeze(dep);
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
	const deps = (run.reaction.deps ??= []);
	if (deps.includes(source)) return;
	deps.push(source);
	subscribe(source, run.reaction);
}

export function settleReads(run: Resumption): void {
	const deps = run.reaction.deps;
	if (deps === null || (run.reaction as Effect).destroyed === true) return;
	let count = 0;
	for (const dep of deps) {
		if (run.reads.has(dep)) deps[count++] = dep;
		else unsubscribe(dep, run.reaction);
	}
	deps.length = count;
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

export interface View {
	readonly batch: Batch;
	readonly values: Map<Source, unknown>;
	readonly hidden: Map<Source, Batch>;
	readonly checked: Map<Derived, boolean>;
	readonly reached: Map<Derived, Set<Batch>>;
}

let frame: Frame | null = null;
let late: Frame | null = null;
let awaited: Resumption | null = null;
let executing: Reaction | null = null;
let evaluating: object | null = null;
const frames: Frame[] = [];
let hiddenByLast: Set<Batch> | null = null;

export let view: View | null = null;

export let owner: Effect | null = null;

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

export function get<T>(source: Source<T>): T {
	if (DEV && frame === null && lost !== null) lose(source);
	const value = read(source);
	if (view !== null && frame !== null) capture(frame, source, value);
	const run = frame === late ? late?.run : awaited;
	if (run !== null && run !== undefined && frame?.target === run.reaction)
		run.values.set(source, value);
	return value;
}

function read<T>(source: Source<T>): T {
	const at = frame;
	if (DEV && tracing !== null) traced(source, at?.target ?? null);
	if (at !== null && source.read !== at.version && (at.local === null || !at.local.has(source)))
		record(at, source);
	if (past !== null) return recall(source, past) as T;
	if (selecting && (leavingCount !== 0 || outgoing !== null)) {
		const given = outgoing ?? (isDerived(source) ? leavingView(source) : null);
		if (given !== null) return readLeaving(source, given) as T;
		if (isDerived(source))
			return withoutLeaving(() => (view === null ? settled(source) : through(source, view))) as T;
	}
	if (view !== null) return through(source, view) as T;
	if (isDerived(source)) return settled(source) as T;
	return source.v;
}

export function settled(derived: Derived): unknown {
	if (derived.status !== CLEAN) refresh(derived);
	const failure = derived.failure;
	if (failure !== null) throw failure.error;
	return derived.v;
}

export function reading(): boolean {
	return frame !== null;
}

export function running(): Reaction | null {
	return executing;
}

export function evaluation(): object | null {
	return executing === null ? null : (evaluating ?? executing);
}

export function withoutReaction<T>(fn: () => T): T {
	const previous = executing;
	const previousFloor = floor;
	executing = null;
	floor = depth;
	try {
		return untrack(fn);
	} finally {
		executing = previous;
		floor = previousFloor;
	}
}

export function untrack<T>(fn: () => T): T {
	const previous = frame;
	const paused = DEV ? pauseLoss() : null;
	frame = null;
	try {
		return fn();
	} finally {
		frame = previous;
		if (DEV) resumeLoss(paused);
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
	return awaited !== null && executing === awaited.reaction ? awaited : null;
}

export function resumeReading(run: Resumption | null): void {
	endReading();
	if (run === null || frame !== null || (run.reaction as Effect).destroyed === true) return;
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
		run
	};
	frame = late;
}

export function endReading(): void {
	if (late === null) return;
	if (frame === late) frame = null;
	late = null;
}

function note(hidden: Iterable<Batch>): void {
	if (frame === null) return;
	for (const batch of hidden) (frame.hidden ??= new Set()).add(batch);
}

export function affected(derived: Derived, given: View): boolean {
	const known = given.checked.get(derived);
	if (known !== undefined) return known;
	given.checked.set(derived, false);
	let found = derived.deps === null;
	for (const dep of derived.deps ?? []) {
		if (given.values.has(dep) || (isDerived(dep) && affected(dep, given))) {
			found = true;
			break;
		}
	}
	given.checked.set(derived, found);
	return found;
}

function compute(derived: Derived, given: View): unknown {
	destroyEffects(derived);
	if (DEV) enter(derived);
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
		if (DEV) leave();
		closed(previous);
		executing = previousReaction;
		evaluating = previousEvaluation;
		setOwner(previousOwner);
		const deps = (derived.deps ??= []);
		const extra = current.extra ?? [];
		if (deps.length === 0 && extra.length > 0) own(derived);
		for (const dep of extra) {
			if (deps.includes(dep)) continue;
			deps.push(dep);
			subscribe(dep, derived);
		}
		if (current.hidden !== null) {
			given.reached.set(derived, current.hidden);
			note(current.hidden);
		}
		finished(current);
	}
}

export function through(source: Source, given: View): unknown {
	if (given.values.has(source)) {
		const hidden = given.hidden.get(source);
		if (hidden !== undefined) note([hidden]);
		else if (isDerived(source)) {
			const reached = given.reached.get(source);
			if (reached !== undefined) note(reached);
		}
		return given.values.get(source);
	}
	if (!isDerived(source)) return source.v;
	if (!affected(source, given)) {
		refresh(source);
		if (!given.values.has(source)) {
			if (source.failure !== null) throw source.failure.error;
			return source.v;
		}
		const reached = given.reached.get(source);
		if (reached !== undefined) note(reached);
		return given.values.get(source);
	}
	const value = compute(source, given);
	if ((source.deps as Source[]).length === 0) {
		given.checked.set(source, false);
		source.v = value;
		source.wv = stamp();
		source.rv = now();
		source.computed = true;
		source.status = CLEAN;
		return value;
	}
	given.values.set(source, value);
	return value;
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
	for (let index = depth - 1; index >= 0; index--) {
		const current = frames[index] as Frame;
		if (!current.invalidated && readBy(current, source)) current.invalidated = true;
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
		if (old === null) target.deps = [];
		else if (!keep && matched < old.length) {
			for (let index = matched; index < old.length; index++)
				unsubscribe(old[index] as Source, target);
			old.length = matched;
		}
		return;
	}
	if (old === previous && extra !== null) {
		const taken = current.version + 2;
		const tail = current.version + 1;
		const empty = old === null || old.length === 0;
		if (old !== null) {
			for (let index = 0; index < matched; index++) (old[index] as Source).read = taken;
			for (let index = matched; index < old.length; index++) (old[index] as Source).read = tail;
		}
		let count = 0;
		for (let index = 0; index < extra.length; index++) {
			const dep = extra[index] as Source;
			const mark = dep.read;
			if (mark === taken) continue;
			dep.read = taken;
			if (mark !== tail) subscribe(dep, target);
			else if (keep) continue;
			extra[count++] = dep;
		}
		extra.length = count;
		if (old === null) target.deps = extra;
		else if (keep) for (const dep of extra) old.push(dep);
		else {
			for (let index = matched; index < old.length; index++) {
				const dep = old[index] as Source;
				if (dep.read === tail) unsubscribe(dep, target);
			}
			if (matched === 0) target.deps = extra;
			else {
				old.length = matched;
				for (const dep of extra) old.push(dep);
			}
		}
		if (empty && count > 0 && isDerived(target)) own(target);
		return;
	}
	const kept = new Set(reads(current));
	const subscribed = new Set(previous);
	for (const dep of subscribed) {
		if (keep) kept.add(dep);
		else if (!kept.has(dep)) unsubscribe(dep, target);
	}
	for (const dep of kept) if (!subscribed.has(dep)) subscribe(dep, target);
	target.deps = [...kept];
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
			if ((target as Effect).destroyed === true) target.deps = null;
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
