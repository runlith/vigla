import { OPEN_ELSE } from '../../shared/markers.ts';
import { flushSync, write } from '../reactivity/scheduler.ts';
import { resumed, suspend } from '../reactivity/views.ts';
import { block } from '../reactivity/effects.ts';
import type { Effect, Source } from '../reactivity/graph.ts';
import { derived, source } from '../reactivity/sources.ts';
import { task } from '../reactivity/tasks.ts';
import { get } from '../reactivity/reads.ts';
import { owner, present, setOwner, untrack } from '../reactivity/tracking.ts';
import { Branches } from './branches.ts';
import { hydrating, instruction } from './hydration.ts';
import type { Render } from './template.ts';

const NONE = -1;
const PENDING = 0;
const THEN = 1;
const CATCH = 2;

export type Outcome = (anchor: ChildNode, value: Source) => void;

interface Run {
	readonly effect: Effect;
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
	const given = derived(input);
	let seen: unknown;
	let run: Run | null = null;
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
	const settle = (from: Run, key: number, update?: () => void): void => {
		if (run !== from || from.effect.destroyed) return;
		const restore = suspend();
		resumed();
		setOwner(from.effect);
		try {
			untrack(() =>
				present(() => {
					update?.();
					branches.show(key, () => render(key));
					if (key === CATCH && caught === null) throw get(error);
					flushSync();
				})
			);
		} finally {
			resumed();
			restore();
		}
	};
	const listen = (promise: PromiseLike<unknown>, from: Run, showing: boolean): void => {
		let done = showing;
		promise.then(
			(result) => {
				done = true;
				settle(from, THEN, () => write(value, result));
			},
			(reason: unknown) => {
				done = true;
				settle(from, CATCH, () => write(error, reason));
			}
		);
		task(() => {
			if (!done) settle(from, PENDING);
		});
	};
	block(() => {
		const current = get(given);
		if (!first && Object.is(current, seen)) return;
		seen = current;
		const promise = thenable(current);
		const matched = first && hydrating ? (instruction(node) === OPEN_ELSE) === !promise : null;
		const from: Run | null = promise ? { effect: owner as Effect } : null;
		run = from;
		const key = promise ? (matched === true ? PENDING : NONE) : THEN;
		if (!promise) write(value, current);
		if (first) {
			first = false;
			branches.start(key, render(key), matched);
		} else if (!promise) {
			branches.show(key, () => render(key));
		}
		if (promise && from !== null) listen(current, from, matched === true);
	});
}
