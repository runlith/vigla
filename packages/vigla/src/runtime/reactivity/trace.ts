import { DEV } from 'esm-env';
import { snapshot } from '../../shared/clone.ts';
import { isDerived, type Derived, type Reaction, type Source } from './graph.ts';
import { ABSENT } from './proxy.ts';
import {
	labelOf,
	ranAt,
	relabelled,
	setTracing,
	tracing,
	untrace,
	updateOf,
	type Tracing
} from './provenance.ts';
import { get } from './reads.ts';
import { running, untrack, view } from './tracking.ts';

const origins = new WeakMap<Source, () => unknown>();
let indirect = false;

class Session implements Tracing {
	readonly reaction: Reaction | null;
	readonly entries = new Map<Source, Error[]>();

	constructor(reaction: Reaction | null) {
		this.reaction = reaction;
	}

	traced(source: Source, reaction: Reaction | null): void {
		if (this.reaction === null) return;
		if (reaction !== this.reaction && !(indirect && reaction === null)) return;
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
		let found = this.entries.get(source);
		if (found === undefined) this.entries.set(source, (found = []));
		if (trace.stack !== found[found.length - 1]?.stack) found.push(trace);
	}
}

export function traceSource(source: Source, read: () => unknown): void {
	if (DEV) origins.set(source, read);
}

export function traceInputs<T>(source: Derived<T>): T {
	const value = untrace(() => untrack(() => get(source)));
	const at = tracing;
	if (at !== null && at.reaction !== null)
		for (const dep of source.deps ?? []) at.traced(dep, at.reaction);
	return value;
}

function log(source: Source, reaction: Reaction, traces: readonly Error[]): void {
	const value = get(source);
	if (value === ABSENT) return;
	const label = labelOf(source);
	const derived = isDerived(source);
	const type = derived ? '$derived' : label?.startsWith('$') ? 'store' : '$state';
	const update = updateOf(source, view);
	const since = ranAt(reaction);
	const version = update?.version ?? (view?.hidden.has(source) ? 0 : source.wv);
	const dirty = since === undefined || version > since;
	const style = dirty
		? 'color: CornflowerBlue; font-weight: bold'
		: 'color: grey; font-weight: normal';
	console.groupCollapsed(
		label === undefined ? `%c${type}%c` : `%c${type}%c ${label}`,
		style,
		dirty ? 'font-weight: normal' : style,
		typeof value === 'object' && value !== null && relabelled(value) ? snapshot(value, true) : value
	);
	if (derived) for (const dep of new Set(source.deps ?? [])) log(dep, reaction, []);
	if (dirty && update?.stack !== null && update?.stack !== undefined) console.log(update.stack);
	for (const trace of traces) console.log(trace);
	console.groupEnd();
}

export function trace<T>(label: () => string, fn: () => T): T {
	if (!DEV) return fn();
	const reaction = running();
	const current = new Session(reaction);
	const previous = setTracing(current);
	try {
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
			setTracing(null);
			console.groupEnd();
		}
		return value;
	} finally {
		setTracing(previous);
	}
}
