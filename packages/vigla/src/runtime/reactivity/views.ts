import { active, live, open, pending, processing, setActive, within, type Batch } from './batch.ts';
import { equal, isDerived, type Source } from './graph.ts';
import {
	endReading,
	owner,
	resumeReading,
	setOwner,
	setView,
	suspendReading,
	type View
} from './tracking.ts';

export function others(batch: Batch): boolean {
	if (batch.after !== null || batch.fork || (open !== null && open !== batch)) return true;
	for (const other of pending) if (other !== batch) return true;
	return false;
}

export function materialize(batch: Batch): Map<Source, unknown> {
	const after = new Map<Source, unknown>();
	const origins = (batch.origins ??= new Map());
	for (const source of batch.before.keys()) {
		after.set(source, source.v);
		if (!origins.has(source)) origins.set(source, { order: batch.order, version: source.wv });
	}
	return after;
}

export function intersects(a: Batch, b: Batch): boolean {
	const [small, large] = a.before.size < b.before.size ? [a, b] : [b, a];
	for (const source of small.before.keys()) if (large.before.has(source)) return true;
	return false;
}

export function inherits(batch: Batch, other: Batch): boolean {
	return !other.fork && !other.done && other.order < batch.order && intersects(other, batch);
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
		if (inherits(batch, other)) return;
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
			if (isDerived(source) || !equal(source, source.v, value)) given.values.set(source, value);
	return given;
}

export function inside<T>(batch: Batch, fn: () => T): T {
	const previous = setView(viewOf(batch));
	try {
		return within(batch, fn);
	} finally {
		setView(previous);
	}
}

export function suspend(): () => void {
	const effect = owner;
	const batch = active ?? processing ?? open;
	const reaction = suspendReading();
	return () => {
		setOwner(effect);
		const next = live(batch);
		setActive(next);
		if (processing === null) setView(next !== null && others(next) ? viewOf(next) : null);
		resumeReading(reaction);
	};
}

export function resumed(): void {
	endReading();
	if (processing !== null) return;
	setOwner(null);
	setActive(null);
	setView(null);
}
