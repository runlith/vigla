import { DEV } from 'esm-env';
import {
	alias,
	enqueue,
	force,
	open,
	opening,
	pending,
	release,
	request,
	rerunAfter,
	type Batch
} from './batch.ts';
import { CLEAN, isDestroyed, type Effect } from './graph.ts';
import { beforeOf } from './history.ts';
import { merged } from './provenance.ts';
import { holding, materialize, type Holding } from './views.ts';

function remap(reader: Batch, from: Batch, into: Batch): void {
	const found = reader.waits?.get(from);
	if (found === undefined) return;
	reader.waits?.delete(from);
	rerunAfter(reader, into, found);
}

export function fold(from: Batch, into: Batch): void {
	if (DEV) merged(from, into);
	const older = from.order < into.order;
	const target = beforeOf(into);
	for (const [source, value] of beforeOf(from)) {
		if (!older && target.has(source)) continue;
		target.set(source, value);
		if (from.passed?.has(source)) (into.passed ??= new Set()).add(source);
		else into.passed?.delete(source);
	}
	if (from.retired !== null) {
		if (into.retired === null) into.retired = from.retired;
		else for (const source of from.retired) into.retired.add(source);
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

export function rescue(batch: Batch, effects: readonly Effect[]): void {
	if (batch.fork) {
		discard(batch);
		return;
	}
	const target = opening();
	for (const effect of effects)
		if (!isDestroyed(effect) && effect.status !== CLEAN) enqueue(target, effect);
	fold(batch, target);
	request();
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
		const rebasing = holding as Holding;
		for (const other of [...pending]) rebasing.rebase(other, batch, changed);
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
