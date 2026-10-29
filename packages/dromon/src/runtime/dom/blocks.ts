import { DEV } from 'esm-env';
import { atCommit, write } from '../reactivity/batch.ts';
import { block } from '../reactivity/effects.ts';
import type { Source } from '../reactivity/graph.ts';
import { state } from '../reactivity/sources.ts';
import { build, discard, leave, place, type Built } from './range.ts';
import type { Render } from './template.ts';

export function branch(anchor: ChildNode, select: () => Render | null): void {
	let current: Render | null = null;
	let shown: Built | null = null;
	let first = true;
	block(() => {
		const arm = select();
		if (!first && arm === current) return;
		const previous = shown;
		current = arm;
		shown = arm === null ? null : build(arm);
		const next = shown;
		const apply = (): void => {
			if (previous !== null) discard(previous);
			if (next !== null) place(next, anchor);
		};
		if (first) {
			first = false;
			apply();
			return;
		}
		if (previous !== null) leave(previous);
		atCommit(apply);
	});
}

interface Row<T> extends Built {
	readonly key: unknown;
	readonly item: Source<T>;
}

export type Item<T> = (anchor: ChildNode, item: Source<T>) => void;

export class DuplicateKey extends Error {
	constructor(key: unknown) {
		super(`Keyed each block has duplicate key \`${String(key)}\``);
		this.name = 'DuplicateKey';
	}
}

export function list<T>(
	anchor: ChildNode,
	collection: () => Iterable<T> | ArrayLike<T>,
	key: ((item: T) => unknown) | null,
	render: Item<T>
): void {
	let rows = new Map<unknown, Row<T>>();
	let order: Row<T>[] = [];
	let first = true;
	block(() => {
		const items = Array.from(collection());
		const next: Row<T>[] = [];
		const seen = new Map<unknown, Row<T>>();
		for (let position = 0; position < items.length; position++) {
			const value = items[position] as T;
			const identity = key === null ? position : key(value);
			if (DEV && seen.has(identity)) throw new DuplicateKey(identity);
			let row = rows.get(identity);
			if (row === undefined) {
				const item = state(value);
				row = { key: identity, item, ...build((at) => render(at, item)) };
			} else if (!Object.is(row.item.v, value)) {
				write(row.item, value);
			}
			seen.set(identity, row);
			next.push(row);
		}
		const removed = order.filter((row) => seen.get(row.key) !== row);
		rows = seen;
		order = next;
		const apply = (): void => {
			for (const row of removed) discard(row);
			let before = anchor;
			for (let position = next.length - 1; position >= 0; position--) {
				const row = next[position] as Row<T>;
				place(row, before);
				if (row.first !== null) before = row.first;
			}
		};
		if (first) {
			first = false;
			apply();
			return;
		}
		for (const row of removed) leave(row);
		atCommit(apply);
	});
}
