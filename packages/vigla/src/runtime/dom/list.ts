import { failure } from '../../shared/diagnostics.ts';
import { OPEN_ELSE } from '../../shared/markers.ts';
import {
	atCommit,
	atDiscard,
	processed,
	skip,
	unskip,
	write,
	type Batch
} from '../reactivity/batch.ts';
import { block } from '../reactivity/effects.ts';
import type { Effect, Source } from '../reactivity/graph.ts';
import { source } from '../reactivity/sources.ts';
import { owner } from '../reactivity/tracking.ts';
import {
	claim,
	cursor,
	hydrating,
	instruction,
	isClose,
	setHydrating,
	skip as removeServer
} from './hydration.ts';
import { build, discard, place, stash, type Built } from './range.ts';
import type { Render } from './template.ts';

interface Row<T> extends Built {
	readonly key: unknown;
	readonly item: Source<T>;
	readonly index: Source<number>;
}

export type Item<T> = (anchor: ChildNode, item: Source<T>, index: Source<number>) => void;

type Collection<T> = Iterable<T> | ArrayLike<T> | null | undefined;

interface Stage<T> {
	readonly rows: readonly Row<T>[];
	readonly empty: boolean;
}

function duplicate(key: unknown, first: number, second: number): Error {
	return failure(
		'each_key_duplicate',
		`Keyed each block has duplicate key \`${String(key)}\` at indexes ${first} and ${second}`
	);
}

function kept(positions: readonly number[]): Set<number> {
	const tails: number[] = [];
	const links = new Array<number>(positions.length);
	for (let at = 0; at < positions.length; at++) {
		const position = positions[at] as number;
		if (position < 0) continue;
		let low = 0;
		let high = tails.length;
		while (low < high) {
			const middle = (low + high) >> 1;
			if ((positions[tails[middle] as number] as number) < position) low = middle + 1;
			else high = middle;
		}
		links[at] = low > 0 ? (tails[low - 1] as number) : -1;
		tails[low] = at;
	}
	const result = new Set<number>();
	for (let at = tails.length > 0 ? (tails.at(-1) as number) : -1; at >= 0; at = links[at] as number)
		result.add(at);
	return result;
}

class List<T> {
	anchor: ChildNode;
	readonly #key: ((item: T, index: number) => unknown) | null;
	readonly #render: Item<T>;
	readonly #fallback: Render | null;
	#block: Effect | null = null;
	readonly #rows = new Map<unknown, Row<T>>();
	#order: readonly Row<T>[] = [];
	#empty: Built | null = null;
	#emptyShown = false;
	#stages: Map<Batch, Stage<T>> | null = null;

	constructor(
		anchor: ChildNode,
		key: ((item: T, index: number) => unknown) | null,
		render: Item<T>,
		fallback: Render | null
	) {
		this.anchor = anchor;
		this.#key = key;
		this.#render = render;
		this.#fallback = fallback;
	}

	#identify(items: ArrayLike<T>, position: number, seen: Map<unknown, number> | null): unknown {
		if (this.#key === null) return position;
		const key = this.#key(items[position] as T, position);
		const earlier = (seen as Map<unknown, number>).get(key);
		if (earlier !== undefined) throw duplicate(key, earlier, position);
		(seen as Map<unknown, number>).set(key, position);
		return key;
	}

	#create(key: unknown, value: T, position: number): Row<T> {
		const item = source(value);
		const index = source(position);
		const row: Row<T> = { key, item, index, ...build((at) => this.#render(at, item, index)) };
		this.#rows.set(key, row);
		return row;
	}

	start(items: ArrayLike<T>): void {
		this.#block = owner;
		let adopting = false;
		let restore = false;
		if (hydrating) {
			const rendered = instruction(this.anchor) !== OPEN_ELSE;
			claim(this.anchor.nextSibling);
			if (rendered === items.length > 0) adopting = true;
			else {
				this.anchor = removeServer();
				setHydrating(false);
				restore = true;
			}
		}
		try {
			const rows: Row<T>[] = [];
			const seen = this.#key === null ? null : new Map<unknown, number>();
			for (let position = 0; position < items.length; position++) {
				const value = items[position] as T;
				const key = this.#identify(items, position, seen);
				if (adopting && isClose(cursor)) {
					this.anchor = cursor;
					adopting = false;
					setHydrating(false);
					restore = true;
				}
				rows.push(this.#create(key, value, position));
			}
			if (items.length === 0 && this.#fallback !== null) {
				this.#empty = build(this.#fallback);
				this.#emptyShown = true;
			}
			if (adopting) this.anchor = isClose(cursor) ? cursor : removeServer();
			if (this.#empty !== null) place(this.#empty, this.anchor);
			let before = this.anchor;
			for (let position = rows.length - 1; position >= 0; position--) {
				const row = rows[position] as Row<T>;
				place(row, before);
				before = row.first;
			}
			this.#order = rows;
		} finally {
			if (restore) setHydrating(true);
		}
	}

	update(items: ArrayLike<T>): void {
		const rows: Row<T>[] = [];
		const seen = this.#key === null ? null : new Map<unknown, number>();
		for (let position = 0; position < items.length; position++) {
			const value = items[position] as T;
			const key = this.#identify(items, position, seen);
			let row = this.#rows.get(key);
			if (row === undefined) row = this.#create(key, value, position);
			else {
				write(row.item, value);
				write(row.index, position);
			}
			rows.push(row);
		}
		const empty = items.length === 0 && this.#fallback !== null;
		if (empty && this.#empty === null) this.#empty = build(this.#fallback as Render);
		const batch = processed();
		const stage: Stage<T> = { rows, empty };
		if (batch === null) {
			this.#apply(stage);
			return;
		}
		const stages = (this.#stages ??= new Map());
		const known = stages.has(batch);
		stages.set(batch, stage);
		const selected = new Set(rows);
		for (const row of this.#rows.values()) {
			if (selected.has(row)) unskip(row.effect);
			else skip(row.effect);
		}
		if (this.#empty !== null) {
			if (empty) unskip(this.#empty.effect);
			else skip(this.#empty.effect);
		}
		if (known) return;
		atCommit(() => this.#commit(batch));
		atDiscard(() => this.#discard(batch));
	}

	#commit(batch: Batch): void {
		const stage = this.#stages?.get(batch);
		if (stage === undefined || this.#block?.destroyed === true) return;
		this.#stages?.delete(batch);
		this.#apply(stage);
	}

	#discard(batch: Batch): void {
		if (this.#stages?.delete(batch) !== true || this.#block?.destroyed === true) return;
		this.#prune(this.#needed());
	}

	#needed(): Set<Row<T>> | null {
		const stages = this.#stages;
		if (stages === null || stages.size === 0) return null;
		const needed = new Set<Row<T>>();
		for (const stage of stages.values()) for (const row of stage.rows) needed.add(row);
		return needed;
	}

	#emptyNeeded(): boolean {
		for (const stage of this.#stages?.values() ?? []) if (stage.empty) return true;
		return false;
	}

	#apply(stage: Stage<T>): void {
		const next = stage.rows;
		const needed = this.#needed();
		const selected = new Set(next);
		const previous = this.#order;
		const positions = new Map<Row<T>, number>();
		for (let position = 0; position < previous.length; position++) {
			const row = previous[position] as Row<T>;
			if (selected.has(row)) positions.set(row, position);
			else if (needed?.has(row)) stash(row);
			else {
				discard(row);
				this.#rows.delete(row.key);
			}
		}
		if (this.#empty !== null) {
			if (stage.empty && !this.#emptyShown) {
				place(this.#empty, this.anchor);
				this.#emptyShown = true;
			} else if (!stage.empty && this.#emptyShown) {
				this.#emptyShown = false;
				if (this.#emptyNeeded()) stash(this.#empty);
				else {
					discard(this.#empty);
					this.#empty = null;
				}
			}
		}
		const order = next.map((row) => positions.get(row) ?? -1);
		let ordered = true;
		for (let at = 0; at < order.length; at++) {
			const position = order[at] as number;
			if (position < 0 || (at > 0 && position < (order[at - 1] as number))) {
				ordered = false;
				break;
			}
		}
		if (!ordered) {
			const stay = kept(order);
			let before = this.anchor;
			for (let at = next.length - 1; at >= 0; at--) {
				const row = next[at] as Row<T>;
				if (!stay.has(at)) place(row, before);
				before = row.first;
			}
		}
		this.#order = next;
		this.#prune(needed);
	}

	#prune(needed: Set<Row<T>> | null): void {
		if (this.#rows.size > this.#order.length) {
			const shown = new Set(this.#order);
			for (const [key, row] of this.#rows) {
				if (shown.has(row) || needed?.has(row)) continue;
				discard(row);
				this.#rows.delete(key);
			}
		}
		if (this.#empty !== null && !this.#emptyShown && !this.#emptyNeeded()) {
			discard(this.#empty);
			this.#empty = null;
		}
	}
}

export function list<T>(
	node: ChildNode,
	collection: () => Collection<T>,
	key: ((item: T, index: number) => unknown) | null,
	render: Item<T>,
	fallback: Render | null = null
): void {
	const rows = new List<T>(node, key, render, fallback);
	let first = true;
	block(() => {
		const given = collection();
		const items: ArrayLike<T> =
			given == null ? [] : Array.isArray(given) ? given : Array.from(given as Iterable<T>);
		if (first) {
			first = false;
			rows.start(items);
			return;
		}
		rows.update(items);
	});
}
