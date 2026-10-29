import { OPEN_ELSE } from '../../shared/markers.ts';
import { flushSync, write } from '../reactivity/batch.ts';
import { block } from '../reactivity/effects.ts';
import type { Source } from '../reactivity/graph.ts';
import { derived, source } from '../reactivity/sources.ts';
import { task } from '../reactivity/tasks.ts';
import { get } from '../reactivity/tracking.ts';
import { Branches } from './branches.ts';
import { hydrating, instruction } from './hydration.ts';
import type { Render } from './template.ts';

const NONE = -1;
const PENDING = 0;
const THEN = 1;
const CATCH = 2;

export type Outcome = (anchor: ChildNode, value: Source) => void;

interface Settled {
	readonly run: object;
	readonly key: number;
}

function thenable(value: unknown): value is PromiseLike<unknown> {
	return typeof (value as PromiseLike<unknown> | null | undefined)?.then === 'function';
}

export function awaited(
	node: ChildNode,
	input: () => unknown,
	pending: Render | null,
	then: Outcome | null,
	caught: Outcome | null
): void {
	const branches = new Branches<number>(node);
	const value = source<unknown>(undefined);
	const error = source<unknown>(undefined);
	const settled = source<Settled | null>(null);
	const given = derived(input);
	let seen: unknown;
	let run: object | null = null;
	let first = true;
	const render = (key: number): Render | null => {
		switch (key) {
			case PENDING:
				return pending;
			case THEN:
				return then === null ? null : (anchor) => then(anchor, value);
			case CATCH:
				return caught === null ? null : (anchor) => caught(anchor, error);
			default:
				return null;
		}
	};
	const settle = (from: object, key: number): void => {
		if (run !== from || effect.destroyed) return;
		write(settled, { run: from, key });
		flushSync();
	};
	const listen = (promise: PromiseLike<unknown>, from: object, showing: boolean): void => {
		let done = showing;
		promise.then(
			(result) => {
				done = true;
				if (run !== from || effect.destroyed) return;
				write(value, result);
				settle(from, THEN);
			},
			(reason: unknown) => {
				done = true;
				if (run !== from || effect.destroyed) return;
				write(error, reason);
				settle(from, CATCH);
			}
		);
		task(() => {
			if (!done) settle(from, PENDING);
		});
	};
	const effect = block(() => {
		const current = get(given);
		const outcome = get(settled);
		const matched =
			first && hydrating ? (instruction(node) === OPEN_ELSE) === !thenable(current) : null;
		let key = NONE;
		let changed = first || !Object.is(current, seen);
		if (changed) {
			seen = current;
			if (thenable(current)) {
				const from = {};
				run = from;
				listen(current, from, matched === true);
				changed = first;
				key = matched === true ? PENDING : NONE;
			} else {
				run = null;
				write(value, current);
				key = THEN;
			}
		} else if (outcome !== null && outcome.run === run) {
			key = outcome.key;
			changed = true;
		}
		if (key === CATCH && caught === null) throw get(error);
		if (first) {
			first = false;
			branches.start(key, render(key), matched);
			return;
		}
		if (changed) branches.show(key, () => render(key));
	});
}
