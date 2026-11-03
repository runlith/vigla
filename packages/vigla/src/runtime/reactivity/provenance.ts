import { DEV } from 'esm-env';
import type { Batch } from './batch.ts';
import { stamp, type Reaction, type Source } from './graph.ts';
import type { View } from './tracking.ts';

export interface Tracing {
	readonly reaction: Reaction | null;
	traced(source: Source, reaction: Reaction | null): void;
}

export interface Update {
	readonly value: unknown;
	readonly version: number;
	readonly stack: Error | null;
}

interface Updates {
	readonly current: WeakMap<Source, Update>;
	readonly before: WeakMap<Source, Update | null>;
}

const labels = new WeakMap<Source, string>();
const relabels = new WeakMap<object, (label: string) => void>();
const updates = new WeakMap<Source, Update>();
const batches = new WeakMap<Batch, Updates>();
const runs = new WeakMap<Reaction, number>();

export let tracing: Tracing | null = null;
let stacks = false;
let repeats = new WeakMap<Source, number>();
let culprits: Map<string, Error> | null = null;

export function setTracing(next: Tracing | null): Tracing | null {
	const previous = tracing;
	tracing = next;
	return previous;
}

export function untrace<T>(fn: () => T): T {
	const previous = setTracing(null);
	try {
		return fn();
	} finally {
		tracing = previous;
	}
}

export function loopWrite(source: Source): void {
	const count = (repeats.get(source) ?? 0) + 1;
	repeats.set(source, count);
	if (count <= 5) return;
	const error = new Error('updated at');
	const stack = error.stack ?? '';
	if (!(culprits ??= new Map()).has(stack)) culprits.set(stack, error);
}

export function resetLoop(): void {
	repeats = new WeakMap();
	culprits = null;
}

export function reportLoop(): void {
	for (const error of culprits?.values() ?? []) console.error(error);
	resetLoop();
}

export function traceStacks(): void {
	if (DEV) stacks = true;
}

export function tag<T extends Source>(source: T, label: string): T {
	if (DEV) {
		labels.set(source, label);
		tagProxy(source.v, label);
	}
	return source;
}

export function labelOf(source: Source): string | undefined {
	return labels.get(source);
}

export function tagProxy<T>(value: T, label: string): T {
	if (DEV && typeof value === 'object' && value !== null) relabels.get(value)?.(label);
	return value;
}

export function labelled(proxy: object, relabel: (label: string) => void): void {
	relabels.set(proxy, relabel);
}

export function relabelled(value: object): boolean {
	return relabels.has(value);
}

export function labelFor(path: string, prop: string | symbol): string {
	if (typeof prop === 'symbol') return `${path}[Symbol(${prop.description ?? ''})]`;
	if (/^[$_\p{ID_Start}][$‌‍\p{ID_Continue}]*$/u.test(prop)) return `${path}.${prop}`;
	return /^\d+$/.test(prop) ? `${path}[${prop}]` : `${path}['${prop}']`;
}

function history(batch: Batch): Updates {
	let found = batches.get(batch);
	if (found === undefined) {
		found = { current: new WeakMap(), before: new WeakMap() };
		batches.set(batch, found);
	}
	return found;
}

export function updated(
	source: Source,
	value: unknown = source.v,
	batch: Batch | null = null
): void {
	const label = labels.get(source);
	if (label !== undefined) tagProxy(value, label);
	if (!stacks) return;
	const entry: Update = {
		value,
		version: batch?.fork ? stamp() : source.wv,
		stack: new Error('updated at')
	};
	if (batch !== null) {
		const found = history(batch);
		if (!found.before.has(source)) found.before.set(source, updates.get(source) ?? null);
		found.current.set(source, entry);
	}
	if (batch === null || !batch.fork) updates.set(source, entry);
}

export function computed(source: Source, value: unknown, batch: Batch): void {
	if (!stacks) return;
	const found = history(batch);
	const previous = found.current.get(source) ?? updates.get(source);
	if (Object.is(previous === undefined ? source.v : previous.value, value)) return;
	found.current.set(source, { value, version: stamp(), stack: null });
}

export function applied(source: Source, batch: Batch): void {
	if (!stacks) return;
	const found = history(batch);
	found.before.set(source, updates.get(source) ?? null);
	const entry: Update = {
		value: source.v,
		version: source.wv,
		stack: found.current.get(source)?.stack ?? null
	};
	found.current.set(source, entry);
	updates.set(source, entry);
}

export function merged(from: Batch, into: Batch): void {
	const source = batches.get(from);
	if (source === undefined) return;
	const target = history(into);
	const older = from.order < into.order;
	for (const value of from.before.keys()) {
		if (older || !target.before.has(value))
			target.before.set(value, source.before.get(value) ?? null);
		const current = source.current.get(value);
		if (current !== undefined && (!older || !target.current.has(value)))
			target.current.set(value, current);
	}
}

export function forgotten(batch: Batch): void {
	batches.delete(batch);
}

export function tracedRun(reaction: Reaction, version: number): void {
	if (stacks) runs.set(reaction, version);
}

export function ranAt(reaction: Reaction): number | undefined {
	return runs.get(reaction);
}

export function updateOf(source: Source, given: View | null): Update | null {
	if (given !== null) {
		const hidden = given.hidden.get(source);
		if (hidden !== undefined && !hidden.fork)
			return batches.get(hidden)?.before.get(source) ?? null;
		const own = batches.get(given.batch)?.current.get(source);
		if (own !== undefined) return own;
	}
	return updates.get(source) ?? null;
}
