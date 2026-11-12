import { DEV } from 'esm-env';
import {
	alias,
	enqueue,
	force,
	members,
	open,
	opening,
	pending,
	release,
	request,
	rerunAfter,
	type Batch
} from './batch.ts';
import {
	BLOCK,
	CLEAN,
	equal,
	isDerived,
	type Effect,
	type Reaction,
	type Source
} from './graph.ts';
import { beforeOf } from './history.ts';
import { merged } from './provenance.ts';
import { changed as changedReads } from './reads.ts';
import { inherits, inside, intersects, materialize } from './views.ts';

export function reconcile(batch: Batch): void {
	let sources: Map<Source, unknown> | null = null;
	for (const other of pending) {
		if (!inherits(batch, other)) continue;
		for (const [source, value] of beforeOf(other)) (sources ??= new Map()).set(source, value);
	}
	if (sources === null) return;
	const seen = new Set<Effect>();
	const memo = new Map<Reaction, boolean>();
	for (const queued of batch.queued) {
		if (queued.destroyed) continue;
		for (let at = queued.parent; at !== null; at = at.parent) {
			if (seen.has(at)) break;
			seen.add(at);
			if (at.kind === BLOCK && at.batch !== batch.order && !at.async && depends(at, sources, memo))
				force(batch, at);
		}
	}
}

function remap(reader: Batch, from: Batch, into: Batch): void {
	const found = reader.waits?.get(from);
	if (found === undefined) return;
	reader.waits?.delete(from);
	rerunAfter(reader, into, found);
}

function fold(from: Batch, into: Batch): void {
	if (DEV) merged(from, into);
	const older = from.order < into.order;
	const target = beforeOf(into);
	for (const [source, value] of beforeOf(from)) {
		if (!older && target.has(source)) continue;
		target.set(source, value);
		if (from.passed?.has(source)) (into.passed ??= new Set()).add(source);
		else into.passed?.delete(source);
	}
	if (from.after !== null || into.after !== null) {
		const merged = (into.after ??= materialize(into));
		for (const [source, value] of from.after ?? materialize(from)) {
			const origin = from.origins?.get(source) ?? { order: from.order, version: source.wv };
			if (merged.has(source) && (into.origins?.get(source)?.order ?? into.order) > origin.order)
				continue;
			merged.set(source, value);
			(into.origins ??= new Map()).set(source, origin);
		}
	}
	for (const [effect, reads] of from.reads ?? [])
		if (!older || !into.reads?.has(effect)) (into.reads ??= new Map()).set(effect, reads);
	for (const effect of from.queued.splice(0)) enqueue(into, effect);
	from.members = null;
	into.effects.push(...from.effects.splice(0));
	into.commits.push(...from.commits.splice(0));
	if (from.discards !== null) (into.discards ??= []).push(...from.discards);
	if (from.content !== null) (into.content ??= []).push(...from.content);
	if (from.deferred !== null) (into.deferred ??= []).push(...from.deferred);
	for (const effect of from.forced ?? []) (into.forced ??= new Set()).add(effect);
	for (const effect of from.skipped ?? []) {
		if (older && (into.skipped?.has(effect) || into.shown?.has(effect))) continue;
		(into.skipped ??= new Set()).add(effect);
		into.shown?.delete(effect);
	}
	for (const effect of from.shown ?? []) {
		if (from.skipped?.has(effect)) continue;
		if (older && (into.skipped?.has(effect) || into.shown?.has(effect))) continue;
		(into.shown ??= new Set()).add(effect);
		into.skipped?.delete(effect);
	}
	for (const [effect, count] of from.owners ?? []) {
		const owners = (into.owners ??= new Map());
		owners.set(effect, (owners.get(effect) ?? 0) + count);
	}
	from.owners = null;
	if (from.settles !== null) (into.settles ??= []).push(...from.settles);
	into.work += from.work;
	from.work = 0;
	from.done = true;
	from.into = into;
	const folded = (into.folded ??= new Set());
	folded.add(from.order);
	for (const order of from.folded ?? []) folded.add(order);
	from.folded = null;
	if (from.merges !== null) {
		for (const transfer of from.merges) transfer(from, into);
		(into.merges ??= []).push(...from.merges);
	}
	if (from.runs !== null) {
		const runs = (into.runs ??= new Map());
		for (const [effect, run] of from.runs) {
			runs.get(effect)?.supersede();
			run.adopt(into);
			runs.set(effect, run);
		}
	}
	const index = pending.indexOf(from);
	if (index !== -1) pending.splice(index, 1);
	for (const [writer, effects] of from.waits ?? []) rerunAfter(into, alias(writer), effects);
	from.waits = null;
	remap(into, from, into);
	for (const other of pending) remap(other, from, into);
	if (open !== null) remap(open, from, into);
	release(from);
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

export function absorb(batch: Batch, content: readonly Effect[]): boolean {
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

export function rescue(batch: Batch, effects: readonly Effect[]): void {
	if (batch.fork) {
		discard(batch);
		return;
	}
	const target = opening();
	for (const effect of effects)
		if (!effect.destroyed && effect.status !== CLEAN) enqueue(target, effect);
	fold(batch, target);
	request();
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
			effect.destroyed ||
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

export function hold(batch: Batch, content: readonly Effect[]): void {
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

function end(batch: Batch): void {
	batch.done = true;
	batch.held = false;
	const index = pending.indexOf(batch);
	if (index !== -1) pending.splice(index, 1);
	for (const done of batch.settles ?? []) done();
	batch.settles = null;
}

export function finish(batch: Batch): void {
	end(batch);
	const waits = batch.waits;
	batch.waits = null;
	if (pending.length > 0) {
		const changed = [...beforeOf(batch).keys()];
		for (const other of [...pending]) rebase(other, batch, changed);
	}
	release(batch);
	if (waits === null) return;
	for (const [writer, effects] of waits) {
		const target = alias(writer);
		if (target.done) continue;
		for (const effect of effects) force(target, effect);
		request();
	}
}

export function discard(batch: Batch): void {
	if (batch.done) return;
	for (const fn of batch.discards ?? []) fn();
	batch.discards = null;
	batch.discarded = true;
	end(batch);
	for (const other of pending) other.waits?.delete(batch);
	open?.waits?.delete(batch);
	release(batch);
}

export function abandon(batch: Batch, content: readonly Effect[]): void {
	for (const list of [batch.queued, content, batch.effects, batch.content, batch.deferred])
		for (const effect of list ?? []) effect.status = CLEAN;
	batch.queued.length = 0;
	batch.effects.length = 0;
	batch.content = batch.deferred = null;
	batch.members = batch.forced = null;
	discard(batch);
}

export function waitFor(batch: Batch): Promise<void> {
	if (batch.done) return Promise.resolve();
	return new Promise((done) => (batch.settles ??= []).push(done));
}

export function adopt(batch: Batch): void {
	if (!pending.includes(batch)) pending.push(batch);
}
