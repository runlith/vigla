import type { Source } from './graph.ts';

export const NONE: unique symbol = Symbol('none');

export type Prior = (source: Source) => unknown;

let orders = 0;
const alive: History[] = [];

function leave(history: History): void {
	const index = alive.indexOf(history);
	if (index === -1) return;
	for (let at = index + 1; at < alive.length; at++) alive[at - 1] = alive[at] as History;
	alive.pop();
}

export interface Origin {
	readonly order: number;
	readonly version: number;
	readonly reads?: ReadonlyMap<Source, unknown>;
}

export function sequence(): number {
	return ++orders;
}

export class History {
	readonly order = sequence();
	log: unknown[] = [];
	map: Map<Source, unknown> | null = null;
	prior: Prior | null = null;
	passed: Set<Source> | null = null;
	crowded = false;

	constructor() {
		alive.push(this);
	}

	get before(): Map<Source, unknown> {
		let map = this.map;
		if (map === null) {
			map = this.map = new Map();
			const log = this.log;
			for (let index = 0; index < log.length; index += 2) {
				const source = log[index] as Source;
				if (!map.has(source)) map.set(source, log[index + 1]);
			}
			this.log = [];
		}
		return map;
	}
}

export function record(history: History, source: Source, previous: unknown, passed: boolean): void {
	const map = history.map;
	if (map !== null) {
		if (map.has(source)) return;
		map.set(source, previous);
		if (passed) (history.passed ??= new Set()).add(source);
		return;
	}
	const logged = source.logged;
	if (logged === history.order) return;
	if (passed) (history.passed ??= new Set()).add(source);
	const oldest = alive[0];
	if (oldest !== undefined && logged >= oldest.order) {
		for (const other of alive)
			if (other.order === logged) {
				other.crowded = true;
				break;
			}
	}
	const log = history.log;
	source.logged = history.order;
	source.slot = log.length + 1;
	log.push(source, previous);
}

function priorOf(history: History, source: Source): unknown {
	const map = history.map;
	if (map === null && !history.crowded)
		return source.logged === history.order ? history.log[source.slot] : NONE;
	const before = map ?? history.before;
	return before.has(source) ? before.get(source) : NONE;
}

export function prior(history: History): Prior {
	return (history.prior ??= (source) => priorOf(history, source));
}

export function earlier(history: History): Prior {
	const passed = history.passed;
	if (passed === null) return prior(history);
	return (source) => (passed.has(source) ? NONE : priorOf(history, source));
}

export function clear(history: History): void {
	leave(history);
	if (history.log.length > 0) history.log = [];
	history.map = null;
	history.prior = null;
	history.passed = null;
}

export function detach(history: History): void {
	void history.before;
	leave(history);
}
