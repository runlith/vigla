import { active, alias, open, opening, pending, processing, request, type Batch } from './batch.ts';
import { CLEAN, isDerived, type Effect, type Reaction, type Source } from './graph.ts';
import { stale, type View } from './tracking.ts';

export function others(batch: Batch): boolean {
	if (batch.fork || (open !== null && open !== batch)) return true;
	for (const other of pending) if (other !== batch && !other.fork) return true;
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
	const own = batch.after;
	const hide = (other: Batch): void => {
		if (other === batch || other.fork || other.done) return;
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
			if (!Object.is(source.v, value)) given.values.set(source, value);
	return given;
}

function force(batch: Batch, effect: Effect): void {
	if (effect.destroyed) return;
	(batch.forced ??= new Set()).add(effect);
	batch.queued.push(effect);
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

export function revisit(effect: Effect, hidden: Set<Batch>): void {
	const reader = active ?? processing;
	for (const found of hidden) {
		const writer = alias(found);
		if (writer.done) continue;
		if (writer.queued.includes(effect)) (writer.forced ??= new Set()).add(effect);
		if (reader !== null && reader !== writer) record(reader, writer, [effect]);
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
	const older = from.order < into.order;
	for (const [source, value] of from.before)
		if (older || !into.before.has(source)) into.before.set(source, value);
	if (from.after !== null || into.after !== null) {
		const merged = (into.after ??= materialize(into));
		for (const [source, value] of from.after ?? materialize(from))
			if (!older || !merged.has(source)) merged.set(source, value);
	}
	into.queued.push(...from.queued.splice(0));
	into.effects.push(...from.effects.splice(0));
	into.commits.push(...from.commits.splice(0));
	if (from.discards !== null) (into.discards ??= []).push(...from.discards);
	if (from.content !== null) (into.content ??= []).push(...from.content);
	if (from.deferred !== null) (into.deferred ??= []).push(...from.deferred);
	for (const effect of from.forced ?? []) (into.forced ??= new Set()).add(effect);
	for (const effect of from.skipped ?? []) (into.skipped ??= new Set()).add(effect);
	if (from.settles !== null) (into.settles ??= []).push(...from.settles);
	into.work += from.work;
	from.work = 0;
	from.done = true;
	from.into = into;
	const index = pending.indexOf(from);
	if (index !== -1) pending.splice(index, 1);
	for (const [writer, effects] of from.waits ?? []) record(into, alias(writer), effects);
	from.waits = null;
	remap(into, from, into);
	for (const other of pending) remap(other, from, into);
	if (open !== null) remap(open, from, into);
}

export function absorb(batch: Batch): Batch {
	for (const held of pending) {
		if (held.fork || held.done || !intersects(batch, held)) continue;
		fold(batch, held);
		return held;
	}
	return batch;
}

export function rescue(batch: Batch, effects: readonly Effect[]): void {
	if (batch.fork) {
		discard(batch);
		return;
	}
	const target = opening();
	for (const effect of effects)
		if (!effect.destroyed && effect.status !== CLEAN) target.queued.push(effect);
	fold(batch, target);
	request();
}

function defer(
	effects: readonly Effect[],
	into: Effect[] | null,
	queued: readonly (readonly [Batch, Set<Effect>])[]
): Effect[] | null {
	if (effects.length === 0) return into;
	const list = into ?? [];
	const known = new Set(list);
	for (const effect of effects) {
		if (effect.destroyed || known.has(effect) || !stale(effect)) continue;
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
			queued.push([other, new Set(other.queued)]);
	if (open !== null && open !== batch && open.queued.length > 0)
		queued.push([open, new Set(open.queued)]);
	batch.content = defer(content, batch.content, queued);
	batch.deferred = defer(batch.effects.splice(0), batch.deferred, queued);
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
		if (
			!batch.fork &&
			after !== null &&
			after.has(source) &&
			!Object.is(source.v, after.get(source))
		) {
			batch.before.delete(source);
			after.delete(source);
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
}

export function waitFor(batch: Batch): Promise<void> {
	if (batch.done) return Promise.resolve();
	return new Promise((done) => (batch.settles ??= []).push(done));
}

export function adopt(batch: Batch): void {
	if (!pending.includes(batch)) pending.push(batch);
}
