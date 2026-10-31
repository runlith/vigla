import { DEV } from 'esm-env';
import type { Batch } from './batch.ts';
import { isDerivedSource, stamp, type Derived, type Reaction, type Source } from './graph.ts';
import { ABSENT, snapshot } from './proxy.ts';
import { get, running, untrack, view } from './tracking.ts';

interface Tracing {
	readonly reaction: Reaction | null;
	readonly entries: Map<Source, Error[]>;
}

interface Update {
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
const origins = new WeakMap<Source, () => unknown>();
const updates = new WeakMap<Source, Update>();
const batches = new WeakMap<Batch, Updates>();
const runs = new WeakMap<Reaction, number>();

export let tracing: Tracing | null = null;
let stacks = false;
let indirect = false;
let repeats = new WeakMap<Source, number>();
let culprits: Map<string, Error> | null = null;

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

export function tagProxy<T>(value: T, label: string): T {
	if (DEV && typeof value === 'object' && value !== null) relabels.get(value)?.(label);
	return value;
}

export function labelled(proxy: object, relabel: (label: string) => void): void {
	relabels.set(proxy, relabel);
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

export function traceSource(source: Source, read: () => unknown): void {
	if (DEV) origins.set(source, read);
}

export function traceInputs<T>(source: Derived<T>): T {
	const value = untrace(() => untrack(() => get(source)));
	const at = tracing;
	if (at !== null && at.reaction !== null)
		for (const dep of source.deps ?? []) traced(dep, at.reaction);
	return value;
}

export function untrace<T>(fn: () => T): T {
	const previous = tracing;
	tracing = null;
	try {
		return fn();
	} finally {
		tracing = previous;
	}
}

export function traced(source: Source, reaction: Reaction | null): void {
	const at = tracing;
	if (at === null || at.reaction === null) return;
	if (reaction !== at.reaction && !(indirect && reaction === null)) return;
	const origin = origins.get(source);
	if (origin !== undefined) {
		const previous = indirect;
		indirect = true;
		try {
			untrack(origin);
		} finally {
			indirect = previous;
		}
		return;
	}
	const trace = new Error('traced at');
	let found = at.entries.get(source);
	if (found === undefined) at.entries.set(source, (found = []));
	if (trace.stack !== found[found.length - 1]?.stack) found.push(trace);
}

function updateOf(source: Source): Update | null {
	if (view !== null) {
		const hidden = view.hidden.get(source);
		if (hidden !== undefined && !hidden.fork)
			return batches.get(hidden)?.before.get(source) ?? null;
		const own = batches.get(view.batch)?.current.get(source);
		if (own !== undefined) return own;
	}
	return updates.get(source) ?? null;
}

function log(source: Source, reaction: Reaction, traces: readonly Error[]): void {
	const value = get(source);
	if (value === ABSENT) return;
	const label = labels.get(source);
	const derived = isDerivedSource(source);
	const type = derived ? '$derived' : label?.startsWith('$') ? 'store' : '$state';
	const update = updateOf(source);
	const since = runs.get(reaction);
	const version = update?.version ?? (view?.hidden.has(source) ? 0 : source.wv);
	const dirty = since === undefined || version > since;
	const style = dirty
		? 'color: CornflowerBlue; font-weight: bold'
		: 'color: grey; font-weight: normal';
	console.groupCollapsed(
		label === undefined ? `%c${type}%c` : `%c${type}%c ${label}`,
		style,
		dirty ? 'font-weight: normal' : style,
		typeof value === 'object' && value !== null && relabels.has(value) ? snapshot(value) : value
	);
	if (derived) for (const dep of new Set(source.deps ?? [])) log(dep, reaction, []);
	if (dirty && update?.stack !== null && update?.stack !== undefined) console.log(update.stack);
	for (const trace of traces) console.log(trace);
	console.groupEnd();
}

export function trace<T>(label: () => string, fn: () => T): T {
	if (!DEV) return fn();
	const previous = tracing;
	const reaction = running();
	try {
		const current: Tracing = { reaction, entries: new Map() };
		tracing = current;
		const start = performance.now();
		const value = fn();
		const time = (performance.now() - start).toFixed(2);
		const prefix = untrack(label);
		if (reaction === null) {
			console.log(`${prefix} %cran outside of an effect (${time}ms)`, 'color: grey');
		} else if (current.entries.size === 0) {
			console.log(`${prefix} %cno reactive dependencies (${time}ms)`, 'color: grey');
		} else {
			console.group(`${prefix} %c(${time}ms)`, 'color: grey');
			untrack(() => {
				for (const [source, traces] of current.entries) log(source, reaction, traces);
			});
			tracing = null;
			console.groupEnd();
		}
		return value;
	} finally {
		tracing = previous;
	}
}
