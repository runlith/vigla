import { DEV } from 'esm-env';
import { failure } from '../../shared/diagnostics.ts';
import { armIndex, OPEN_ELSE } from '../../shared/markers.ts';
import { atCommit, write } from '../reactivity/batch.ts';
import { block } from '../reactivity/effects.ts';
import type { Source } from '../reactivity/graph.ts';
import { state } from '../reactivity/sources.ts';
import {
	advance,
	claim,
	cursor,
	hydrating,
	instruction,
	isClose,
	mismatch,
	setHydrating,
	skip
} from './hydration.ts';
import { build, discard, leave, place, type Built } from './range.ts';
import type { Render } from './template.ts';

function enter(marker: ChildNode): void {
	claim(marker.nextSibling);
}

function closing(): ChildNode {
	if (!isClose(cursor)) mismatch();
	return cursor;
}

export function branch(
	node: ChildNode,
	select: () => number,
	arms: readonly Render[],
	fallback: Render | null
): void {
	let anchor = node;
	let current = Number.NaN;
	let shown: Built | null = null;
	let first = true;
	const render = (index: number): Render | null =>
		index === -1 ? fallback : (arms[index] ?? null);
	block(() => {
		const index = select();
		if (!first && index === current) return;
		const previous = shown;
		current = index;
		const arm = render(index);
		if (first) {
			first = false;
			if (hydrating) {
				const matched = armIndex(instruction(node)) === index;
				enter(node);
				if (matched) {
					shown = arm === null ? null : build(arm);
					anchor = closing();
					return;
				}
				anchor = skip();
				setHydrating(false);
				try {
					shown = arm === null ? null : build(arm);
				} finally {
					setHydrating(true);
				}
				if (shown !== null) place(shown, anchor);
				return;
			}
			shown = arm === null ? null : build(arm);
			if (shown !== null) place(shown, anchor);
			return;
		}
		shown = arm === null ? null : build(arm);
		const next = shown;
		if (previous !== null) leave(previous);
		atCommit(() => {
			if (previous !== null) discard(previous);
			if (next !== null) place(next, anchor);
		});
	});
}

interface Row<T> extends Built {
	readonly key: unknown;
	readonly item: Source<T>;
	readonly index: Source<number>;
}

export type Item<T> = (anchor: ChildNode, item: Source<T>, index: Source<number>) => void;

type Collection<T> = Iterable<T> | ArrayLike<T> | null | undefined;

function duplicate(key: unknown, first: number, second: number): Error {
	return failure(
		'each_key_duplicate',
		`Keyed each block has duplicate key \`${String(key)}\` at indexes ${first} and ${second}`
	);
}

export function list<T>(
	node: ChildNode,
	collection: () => Collection<T>,
	key: ((item: T, index: number) => unknown) | null,
	render: Item<T>,
	fallback: Render | null = null
): void {
	let anchor = node;
	let rows = new Map<unknown, Row<T>>();
	let order: Row<T>[] = [];
	let empty: Built | null = null;
	let first = true;
	const create = (identity: unknown, value: T, position: number): Row<T> => {
		const item = state(value);
		const index = state(position);
		return { key: identity, item, index, ...build((at) => render(at, item, index)) };
	};
	block(() => {
		const given = collection();
		const items: ArrayLike<T> =
			given == null ? [] : Array.isArray(given) ? given : Array.from(given as Iterable<T>);
		const initial = first;
		first = false;
		let adopting = false;
		let restore = false;
		if (initial && hydrating) {
			const rendered = instruction(node) !== OPEN_ELSE;
			enter(node);
			if (rendered === items.length > 0) {
				adopting = true;
			} else {
				anchor = skip();
				setHydrating(false);
				restore = true;
			}
		}
		try {
			const next: Row<T>[] = [];
			const seen = new Map<unknown, Row<T>>();
			for (let position = 0; position < items.length; position++) {
				const value = items[position] as T;
				const identity = key === null ? position : key(value, position);
				if (DEV && seen.has(identity)) {
					throw duplicate(identity, next.indexOf(seen.get(identity) as Row<T>), position);
				}
				let row = rows.get(identity);
				if (row === undefined) {
					if (adopting && isClose(cursor)) {
						anchor = cursor;
						adopting = false;
						setHydrating(false);
						restore = true;
					}
					row = create(identity, value, position);
				} else {
					if (!Object.is(row.item.v, value)) write(row.item, value);
					if (row.index.v !== position) write(row.index, position);
				}
				seen.set(identity, row);
				next.push(row);
			}
			const leaving = empty;
			const shownEmpty =
				items.length > 0 || fallback === null ? null : (leaving ?? build(fallback));
			if (adopting) anchor = isClose(cursor) ? cursor : skip();
			const removed = order.filter((row) => seen.get(row.key) !== row);
			rows = seen;
			order = next;
			empty = shownEmpty;
			const apply = (): void => {
				for (const row of removed) discard(row);
				if (leaving !== null && leaving !== shownEmpty) discard(leaving);
				if (shownEmpty !== null && shownEmpty !== leaving) place(shownEmpty, anchor);
				let before = anchor;
				for (let position = next.length - 1; position >= 0; position--) {
					const row = next[position] as Row<T>;
					place(row, before);
					before = row.first;
				}
			};
			if (initial) {
				apply();
				return;
			}
			for (const row of removed) leave(row);
			if (leaving !== null && leaving !== shownEmpty) leave(leaving);
			atCommit(apply);
		} finally {
			if (restore) setHydrating(true);
		}
	});
}
