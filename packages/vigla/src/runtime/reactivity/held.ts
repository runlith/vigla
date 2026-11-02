import {
	active,
	alias,
	detach,
	enqueue,
	members,
	open,
	opening,
	pending,
	processing,
	release,
	request,
	type Batch
} from './batch.ts';
import {
	BLOCK,
	BRANCH,
	CLEAN,
	ROOT,
	equal,
	isDerived,
	type Effect,
	type Reaction,
	type Source
} from './graph.ts';
import type { View } from './tracking.ts';
import { DEV } from 'esm-env';
import { merged } from './trace.ts';

export const overlooked = new WeakSet<Effect>();

function gather(effect: Effect, out: Effect[], marked: boolean, adopter = 0): void {
	if (marked) effect.pending = false;
	for (let child = effect.first; child !== null; child = child.next) {
		if (child.destroyed) continue;
		const forked = adopter !== 0 && child.forked !== 0 && child.forked !== adopter;
		if ((child.status !== CLEAN || forked) && child.kind !== BRANCH && child.kind !== ROOT)
			out.push(child);
		if (!marked || child.pending) gather(child, out, marked, adopter);
	}
}

export function overlook(branch: Effect, from: Batch): void {
	const found: Effect[] = [];
	gather(branch, found, true);
	overlooked.add(branch);
	if (found.length === 0 || from.fork) return;
	const pass = (other: Batch | null): void => {
		if (other === null || other === from || other.done) return;
		if (other.shown === null || !other.shown.has(branch)) return;
		for (const effect of found) force(other, effect);
		request();
	};
	for (const other of pending) pass(other);
	pass(open);
}

export function requeue(batch: Batch, branch: Effect): void {
	overlooked.delete(branch);
	const found: Effect[] = [];
	gather(branch, found, false, batch.order);
	for (const effect of found) force(batch, effect);
}

function park(batch: Batch): void {
	const index = pending.indexOf(batch);
	if (index !== -1) pending.splice(index, 1);
	batch.queued.length = 0;
	batch.commits.length = 0;
	batch.effects.length = 0;
	batch.members = batch.forced = batch.skipped = batch.shown = batch.waits = null;
	batch.content = batch.deferred = batch.discards = null;
	batch.runs = null;
	batch.merges = null;
	for (const other of pending) other.waits?.delete(batch);
	open?.waits?.delete(batch);
	detach(batch);
}

export function orphaned(root: Effect): void {
	if (pending.length === 0) return;
	for (const batch of [...pending]) {
		const roots = batch.roots;
		if (!batch.fork || roots === null || !roots.delete(root)) continue;
		if (roots.size === 0) park(batch);
	}
}

export function untouched(batch: Batch): void {
	if (batch.fork && batch.roots === null && !batch.done) park(batch);
}

export function others(batch: Batch): boolean {
	if (batch.after !== null || batch.fork || (open !== null && open !== batch)) return true;
	for (const other of pending) if (other !== batch) return true;
	return false;
}

export function viewOf(batch: Batch): View {
	const given: View = {
		batch,
		values: new Map(),
		hidden: new Map(),
		checked: new Map(),
		reached: new Map()
	};
	const own = (batch.after ??= materialize(batch));
	const hide = (other: Batch): void => {
		if (other === batch || other.done) return;
		if (other.fork) {
			for (const source of other.after?.keys() ?? []) {
				if ((own !== null && own.has(source)) || given.values.has(source)) continue;
				given.values.set(source, source.v);
				given.hidden.set(source, other);
			}
			return;
		}
		for (const [source, value] of other.before) {
			if ((own !== null && own.has(source)) || given.values.has(source)) continue;
			given.values.set(source, value);
			given.hidden.set(source, other);
		}
	};
	for (const other of pending) hide(other);
	if (open !== null) hide(open);
	if (own !== null)
		for (const [source, value] of own)
			if (!equal(source, source.v, value)) given.values.set(source, value);
	return given;
}

function force(batch: Batch, effect: Effect): void {
	if (effect.destroyed) return;
	(batch.forced ??= new Set()).add(effect);
	enqueue(batch, effect);
}

function record(reader: Batch, writer: Batch, effects: Iterable<Effect>): void {
	if (writer.done) return;
	if (writer === reader) {
		for (const effect of effects) force(reader, effect);
		return;
	}
	const waits = (reader.waits ??= new Map());
	let found = waits.get(writer);
	if (found === undefined) waits.set(writer, (found = new Set()));
	for (const effect of effects) found.add(effect);
}

export function revisit(effect: Effect, hidden: Set<Batch> | null): void {
	const reader = active ?? processing;
	for (const found of hidden ?? []) {
		const writer = alias(found);
		if (writer.done) continue;
		if (members(writer).has(effect)) (writer.forced ??= new Set()).add(effect);
		if (reader !== null && reader !== writer) record(reader, writer, [effect]);
	}
	for (const other of pending) {
		if (other === reader || other.done || other.fork || other.queued.length === 0) continue;
		if (members(other).has(effect)) (other.forced ??= new Set()).add(effect);
	}
}

function intersects(a: Batch, b: Batch): boolean {
	const [small, large] = a.before.size < b.before.size ? [a, b] : [b, a];
	for (const source of small.before.keys()) if (large.before.has(source)) return true;
	return false;
}

function materialize(batch: Batch): Map<Source, unknown> {
	const after = new Map<Source, unknown>();
	for (const source of batch.before.keys()) after.set(source, source.v);
	return after;
}

function remap(reader: Batch, from: Batch, into: Batch): void {
	const found = reader.waits?.get(from);
	if (found === undefined) return;
	reader.waits?.delete(from);
	record(reader, into, found);
}

function fold(from: Batch, into: Batch): void {
	if (DEV) merged(from, into);
	const older = from.order < into.order;
	for (const [source, value] of from.before) {
		if (!older && into.before.has(source)) continue;
		into.before.set(source, value);
		if (from.passed?.has(source)) (into.passed ??= new Set()).add(source);
		else into.passed?.delete(source);
	}
	if (from.after !== null || into.after !== null) {
		const merged = (into.after ??= materialize(into));
		for (const [source, value] of from.after ?? materialize(from))
			if (!older || !merged.has(source)) merged.set(source, value);
	}
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
	for (const [writer, effects] of from.waits ?? []) record(into, alias(writer), effects);
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
	const changed = [...batch.before.keys()];
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
	const seen = new Set<Source>();
	const visit = (source: Source): void => {
		if (seen.has(source)) return;
		seen.add(source);
		for (const reaction of source.reactions ?? []) {
			if (isDerived(reaction)) visit(reaction);
			else if (depends(reaction, batch.before, memo)) rerun.add(reaction as Effect);
		}
	};
	const after = batch.after;
	for (const source of changed) {
		if (after !== null && after.has(source)) {
			const value = committed.after?.has(source) ? committed.after.get(source) : source.v;
			batch.before.set(source, value);
			if (batch.fork || batch.order > committed.order || equal(source, value, after.get(source)))
				continue;
			after.set(source, value);
		}
		visit(source);
	}
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
		const changed = [...batch.before.keys()];
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
