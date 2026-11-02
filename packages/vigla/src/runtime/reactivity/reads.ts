import { asynchronous } from './async.ts';
import { processed } from './batch.ts';
import { refresh } from './deriveds.ts';
import {
	BLOCK,
	CLEAN,
	DIRTY,
	MAYBE,
	equal,
	isDerived,
	type Effect,
	type Reaction,
	type Source
} from './graph.ts';
import { affected, get, validate, view } from './tracking.ts';

const collecting = new WeakMap<object, Map<Source, unknown>>();
const observed = new WeakMap<Reaction, Map<Source, unknown>>();
const viewed = new WeakSet<Reaction>();

export function capture(frame: object, source: Source, value: unknown): void {
	let reads = collecting.get(frame);
	if (reads === undefined) collecting.set(frame, (reads = new Map()));
	reads.set(source, value);
}

export function retain(target: Reaction, frame: object): void {
	const reads = collecting.get(frame);
	if (reads === undefined) observed.delete(target);
	else observed.set(target, reads);
	if (view !== null && reads !== undefined) viewed.add(target);
	else viewed.delete(target);
	const effect = target as Effect;
	const batch = view?.batch ?? processed();
	if (
		effect.kind === BLOCK &&
		!asynchronous.has(effect) &&
		reads !== undefined &&
		batch !== null &&
		(batch.after !== null || batch.work > 0 || batch.fork)
	)
		(batch.reads ??= new Map()).set(effect, reads);
}

export function clear(frame: object): void {
	collecting.delete(frame);
}

export function changed(reads: ReadonlyMap<Source, unknown>, target: Reaction): boolean {
	return validate(target, () => {
		for (const [source, value] of reads) if (!equal(source, value, get(source))) return true;
		return false;
	});
}

export function stale(target: Reaction, recheck = false): boolean {
	if (recheck) {
		if (target.deps === null) return true;
		const effect = target as Effect;
		const own = (view?.batch ?? processed())?.reads?.get(effect);
		if (
			own === undefined &&
			effect.kind === BLOCK &&
			(!asynchronous.has(effect) || effect.forked) &&
			effect.batch !== 0 &&
			effect.batch !== (view?.batch.order ?? processed()?.order)
		)
			return true;
		const reads = own ?? observed.get(target);
		if (reads !== undefined) {
			const dirty = changed(reads, target);
			if (!dirty) target.status = CLEAN;
			return dirty;
		}
		target.status = MAYBE;
	}
	const status = target.status;
	if (status === DIRTY) return true;
	if (status === MAYBE) {
		const effect = target as Effect;
		const batch = view?.batch ?? processed();
		if (
			effect.kind === BLOCK &&
			effect.forked &&
			!asynchronous.has(effect) &&
			effect.batch !== batch?.order &&
			!batch?.reads?.has(effect)
		)
			return true;
		const reads = viewed.has(target) ? observed.get(target) : undefined;
		if (reads !== undefined) {
			const dirty = changed(reads, target);
			if (!dirty) target.status = CLEAN;
			return dirty;
		}
		const deps = target.deps;
		if (deps !== null) {
			for (let index = 0; index < deps.length; index++) {
				const dep = deps[index] as Source;
				if (isDerived(dep)) {
					if (view !== null) {
						if (affected(dep, view)) return true;
						refresh(dep);
						if (view.values.has(dep)) return true;
					} else if (dep.status !== CLEAN) refresh(dep);
				}
				if (dep.wv > target.rv) return true;
			}
		}
		target.status = CLEAN;
	}
	return false;
}
