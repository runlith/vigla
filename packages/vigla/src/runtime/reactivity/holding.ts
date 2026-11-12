import { force, members, open, pending, request, type Batch } from './batch.ts';
import {
	ASYNC,
	BLOCK,
	CLEAN,
	equal,
	isDerived,
	isDestroyed,
	type Effect,
	type Reaction,
	type Source
} from './graph.ts';
import { fold } from './held.ts';
import { beforeOf } from './history.ts';
import { changed as changedReads } from './reads.ts';
import {
	holding,
	inherits,
	inside,
	intersects,
	materialize,
	setHolding,
	viewOf,
	type Holding
} from './views.ts';

function reconcile(batch: Batch): void {
	let sources: Map<Source, unknown> | null = null;
	for (const other of pending) {
		if (!inherits(batch, other)) continue;
		for (const [source, value] of beforeOf(other)) (sources ??= new Map()).set(source, value);
	}
	if (sources === null) return;
	const seen = new Set<Effect>();
	const memo = new Map<Reaction, boolean>();
	for (const queued of batch.queued) {
		if (isDestroyed(queued)) continue;
		for (let at = queued.parent; at !== null; at = at.parent) {
			if (seen.has(at)) break;
			seen.add(at);
			if (
				at.kind === BLOCK &&
				at.batch !== batch.order &&
				(at.flags & ASYNC) === 0 &&
				depends(at, sources, memo)
			)
				force(batch, at);
		}
	}
}

function mergedEffects(
	batch: Batch,
	changed: readonly Source[],
	reused: ReadonlySet<Effect>
): void {
	const seen = new Set<Source>();
	const visit = (source: Source): void => {
		if (seen.has(source)) return;
		seen.add(source);
		for (const reaction of source.reactions ?? []) {
			if (isDerived(reaction)) visit(reaction);
			else {
				const effect = reaction as Effect;
				if (effect.kind === BLOCK && !reused.has(effect)) force(batch, effect);
			}
		}
	};
	for (const source of changed) visit(source);
}

function absorb(batch: Batch, content: readonly Effect[]): boolean {
	let target: Batch | null = null;
	for (const held of pending) {
		if (held.order >= batch.order || held.fork || held.done || held.phase !== null) continue;
		if (target !== null && held.order <= target.order) continue;
		if (intersects(batch, held)) target = held;
	}
	if (target === null) return false;
	hold(batch, content);
	const changed = [...beforeOf(batch).keys()];
	const reused = new Set(batch.runs?.keys());
	fold(batch, target);
	mergedEffects(target, changed, reused);
	return true;
}

function defer(
	batch: Batch,
	effects: readonly Effect[],
	into: Effect[] | null,
	queued: readonly (readonly [Batch, Set<Effect>])[]
): Effect[] | null {
	if (effects.length === 0) return into;
	const list = into ?? [];
	const known = new Set(list);
	for (const effect of effects) {
		if (
			isDestroyed(effect) ||
			known.has(effect) ||
			(effect.status === CLEAN && batch.forced?.has(effect) !== true)
		)
			continue;
		effect.status = CLEAN;
		known.add(effect);
		list.push(effect);
		for (const [other, members] of queued)
			if (members.has(effect)) (other.forced ??= new Set()).add(effect);
	}
	return list;
}

function hold(batch: Batch, content: readonly Effect[]): void {
	batch.held = true;
	batch.after ??= materialize(batch);
	const queued: (readonly [Batch, Set<Effect>])[] = [];
	for (const other of pending)
		if (other !== batch && !other.done && other.queued.length > 0)
			queued.push([other, members(other)]);
	if (open !== null && open !== batch && open.queued.length > 0) queued.push([open, members(open)]);
	batch.content = defer(batch, content, batch.content, queued);
	batch.deferred = defer(batch, batch.effects.splice(0), batch.deferred, queued);
	if (!pending.includes(batch)) pending.push(batch);
}

function depends(
	reaction: Reaction,
	sources: Map<Source, unknown>,
	memo: Map<Reaction, boolean>
): boolean {
	const known = memo.get(reaction);
	if (known !== undefined) return known;
	memo.set(reaction, false);
	let found = false;
	for (const dep of reaction.deps ?? []) {
		if (sources.has(dep) || (isDerived(dep) && depends(dep, sources, memo))) {
			found = true;
			break;
		}
	}
	memo.set(reaction, found);
	return found;
}

function rebase(batch: Batch, committed: Batch, changed: readonly Source[]): void {
	const rerun = new Set<Effect>(batch.waits?.get(committed) ?? []);
	batch.waits?.delete(committed);
	const memo = new Map<Reaction, boolean>();
	const seen = new Map<Source, number>();
	const visit = (source: Source, version: number): void => {
		if ((seen.get(source) ?? -1) >= version) return;
		seen.set(source, version);
		for (const reaction of source.reactions ?? []) {
			if (isDerived(reaction)) {
				const assigned = batch.origins?.get(reaction);
				if (
					assigned !== undefined &&
					assigned.version < version &&
					(assigned.reads === undefined ||
						inside(batch, () => changedReads(assigned.reads!, reaction)))
				) {
					batch.after?.delete(reaction);
					beforeOf(batch).delete(reaction);
					batch.origins?.delete(reaction);
				}
				visit(reaction, version);
			} else if (depends(reaction, beforeOf(batch), memo)) rerun.add(reaction as Effect);
		}
	};
	const after = batch.after;
	const affected: Source[] = [];
	for (const source of changed) {
		if (after !== null && after.has(source)) {
			const value = committed.after?.has(source) ? committed.after.get(source) : source.v;
			beforeOf(batch).set(source, value);
			const origin = committed.origins?.get(source) ?? {
				order: committed.order,
				version: source.wv
			};
			if ((batch.origins?.get(source)?.order ?? batch.order) > origin.order) continue;
			(batch.origins ??= new Map()).set(source, origin);
			if (equal(source, value, after.get(source))) continue;
			after.set(source, value);
		}
		affected.push(source);
	}
	for (const source of affected)
		visit(source, committed.origins?.get(source)?.version ?? source.wv);
	for (const effect of rerun) force(batch, effect);
	if (batch.queued.length > 0) request();
}

export function waitFor(batch: Batch): Promise<void> {
	if (batch.done) return Promise.resolve();
	return new Promise((done) => (batch.settles ??= []).push(done));
}

export function adopt(batch: Batch): void {
	if (!pending.includes(batch)) pending.push(batch);
}

const hooks: Holding = { reconcile, absorb, hold, rebase, viewOf, inside };

export function useHolding(): void {
	if (holding === null) setHolding(hooks);
}
