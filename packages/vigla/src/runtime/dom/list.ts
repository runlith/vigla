import { DEV } from 'esm-env';
import { failure } from '../../shared/diagnostics.ts';
import { OPEN_ELSE } from '../../shared/markers.ts';
import {
	alias,
	atCommit,
	atDiscard,
	atMerge,
	processed,
	skip,
	unskip,
	write,
	type Batch
} from '../reactivity/batch.ts';
import { block, hide, show as unhide } from '../reactivity/effects.ts';
import type { Derived, Effect, Source } from '../reactivity/graph.ts';
import { derived, mutableEqual, mutableSource, source } from '../reactivity/sources.ts';
import { get, owner } from '../reactivity/tracking.ts';
import { traceInputs, traceSource, untrace } from '../reactivity/trace.ts';
import {
	claim,
	cursor,
	hydrating,
	instruction,
	isClose,
	setHydrating,
	skip as removeServer
} from './hydration.ts';
import {
	animateMoves,
	building,
	moverOf,
	pause,
	prepare,
	resume,
	type Mover
} from '../transitions/manager.ts';
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
	const shown = String(key);
	return failure(
		'each_key_duplicate',
		shown.startsWith('[object ')
			? `Keyed each block has duplicate key at indexes ${first} and ${second}`
			: `Keyed each block has duplicate key \`${shown}\` at indexes ${first} and ${second}`
	);
}

function volatile(position: number, first: unknown, second: unknown): Error {
	return failure(
		'each_key_volatile',
		`Keyed each block has key that is not idempotent — the key for item at index ${position} was \`${String(first)}\` but is now \`${String(second)}\`. Keys must be the same each time for a given item`
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
	readonly #collection: Derived<ArrayLike<T>>;
	readonly #key: ((item: T, index: number) => unknown) | null;
	readonly #render: Item<T>;
	readonly #fallback: Render | null;
	readonly #mutable: boolean;
	#block: Effect | null = null;
	#start: ChildNode | null = null;
	readonly #rows = new Map<unknown, Row<T>>();
	readonly #leaving = new Set<Row<T>>();
	#order: readonly Row<T>[] = [];
	#empty: Built | null = null;
	#emptyShown = false;
	#stages: Map<Batch, Stage<T>> | null = null;

	constructor(
		anchor: ChildNode,
		collection: Derived<ArrayLike<T>>,
		key: ((item: T, index: number) => unknown) | null,
		render: Item<T>,
		fallback: Render | null,
		mutable: boolean
	) {
		this.anchor = anchor;
		this.#collection = collection;
		this.#key = key;
		this.#render = render;
		this.#fallback = fallback;
		this.#mutable = mutable;
	}

	#identify(items: ArrayLike<T>, position: number, seen: Map<unknown, number> | null): unknown {
		if (this.#key === null) return position;
		const key = this.#key(items[position] as T, position);
		if (DEV) {
			const again = this.#key(items[position] as T, position);
			if (!Object.is(key, again)) throw volatile(position, key, again);
		}
		const earlier = (seen as Map<unknown, number>).get(key);
		if (earlier !== undefined) throw duplicate(key, earlier, position);
		(seen as Map<unknown, number>).set(key, position);
		return key;
	}

	#create(key: unknown, value: T, position: number, update: boolean): Row<T> {
		const item = this.#mutable ? mutableSource(value) : source(value);
		const index = source(position);
		if (DEV)
			traceSource(item, () => {
				const position = untrace(() => get(index));
				return traceInputs(this.#collection)[position];
			});
		const built = building(update, () => build((at) => this.#render(at, item, index)));
		const row: Row<T> = { key, item, index, ...built };
		this.#rows.set(key, row);
		return row;
	}

	start(items: ArrayLike<T>): void {
		this.#block = owner;
		let adopting = false;
		let restore = false;
		if (hydrating) this.#start = this.anchor;
		else {
			this.#start = document.createTextNode('');
			this.anchor.before(this.#start);
		}
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
				rows.push(this.#create(key, value, position, false));
			}
			if (items.length === 0 && this.#fallback !== null) {
				this.#empty = building(false, () => build(this.#fallback as Render));
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
		const batch = processed();
		const rows: Row<T>[] = [];
		const seen = this.#key === null ? null : new Map<unknown, number>();
		for (let position = 0; position < items.length; position++) {
			const value = items[position] as T;
			const key = this.#identify(items, position, seen);
			let row = this.#rows.get(key);
			if (row === undefined) {
				row = this.#create(key, value, position, true);
				if (batch !== null) hide(row.effect);
			} else {
				write(row.item, value);
				write(row.index, position);
			}
			rows.push(row);
		}
		const empty = items.length === 0 && this.#fallback !== null;
		if (empty && this.#empty === null) {
			this.#empty = building(true, () => build(this.#fallback as Render));
			if (batch !== null) hide(this.#empty.effect);
		}
		const stage: Stage<T> = { rows, empty };
		if (batch === null) {
			this.#capture(stage);
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
		atCommit({ prepare: () => this.#prepare(batch), apply: () => this.#commit(batch) });
		atDiscard(() => this.#discard(batch));
		atMerge((from, into) => this.#merge(from, into));
	}

	#merge(from: Batch, into: Batch): void {
		const stages = this.#stages;
		const stage = stages?.get(from);
		if (stages === null || stage === undefined) return;
		stages.delete(from);
		if (from.order > into.order || !stages.has(into)) stages.set(into, stage);
	}

	#capture(stage: Stage<T>): void {
		const selected = new Set(stage.rows);
		for (const row of this.#order) {
			if (selected.has(row)) moverOf(row.effect)?.measure();
			else prepare(row.effect);
		}
		for (const row of stage.rows) if (this.#leaving.has(row)) prepare(row.effect);
	}

	#prepare(given: Batch): void {
		const stage = this.#stages?.get(alias(given));
		if (stage !== undefined && this.#block?.destroyed !== true) this.#capture(stage);
	}

	#commit(given: Batch): void {
		const batch = alias(given);
		const stage = this.#stages?.get(batch);
		if (stage === undefined || this.#block?.destroyed === true) return;
		this.#stages?.delete(batch);
		this.#apply(stage);
	}

	#discard(given: Batch): void {
		const batch = alias(given);
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
		}
		const moved: Mover[] = [];
		for (const row of next) {
			const mover = positions.has(row) ? moverOf(row.effect) : undefined;
			if (mover !== undefined) moved.push(mover);
		}
		for (const row of previous) {
			if (selected.has(row)) continue;
			if (needed?.has(row)) {
				stash(row);
				hide(row.effect);
				continue;
			}
			moverOf(row.effect)?.fix();
			this.#leave(row);
		}
		if (this.#empty !== null) {
			if (stage.empty && !this.#emptyShown) {
				place(this.#empty, this.anchor);
				unhide(this.#empty.effect);
				this.#emptyShown = true;
			} else if (!stage.empty && this.#emptyShown) {
				this.#emptyShown = false;
				if (this.#emptyNeeded()) {
					stash(this.#empty);
					hide(this.#empty.effect);
				} else {
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
			let after = this.#start as ChildNode;
			for (let at = 0; at < next.length; at++) {
				const row = next[at] as Row<T>;
				if (!stay.has(at)) {
					if (this.#leaving.delete(row)) {
						moverOf(row.effect)?.unfix();
						resume(row.effect);
					}
					const before = after.nextSibling as ChildNode;
					if (before !== row.first) place(row, before);
					unhide(row.effect);
				}
				after = row.last;
			}
		}
		this.#order = next;
		this.#prune(needed);
		animateMoves(moved);
	}

	#leave(row: Row<T>): void {
		this.#leaving.add(row);
		pause(row.effect, () => {
			if (!this.#leaving.delete(row) || this.#block?.destroyed === true) return;
			moverOf(row.effect)?.unfix();
			if (this.#needed()?.has(row)) {
				stash(row);
				return;
			}
			discard(row);
			if (this.#rows.get(row.key) === row) this.#rows.delete(row.key);
		});
	}

	#prune(needed: Set<Row<T>> | null): void {
		if (this.#rows.size > this.#order.length + this.#leaving.size) {
			const shown = new Set(this.#order);
			for (const [key, row] of this.#rows) {
				if (shown.has(row) || this.#leaving.has(row) || needed?.has(row)) continue;
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
	fallback: Render | null = null,
	mutable = false
): void {
	const values = derived<ArrayLike<T>>(
		() => {
			const given = collection();
			return given == null ? [] : Array.isArray(given) ? given : Array.from(given as Iterable<T>);
		},
		mutable ? mutableEqual : undefined
	);
	const rows = new List<T>(node, values, key, render, fallback, mutable);
	let first = true;
	block(() => {
		const items = get(values);
		if (first) {
			first = false;
			rows.start(items);
			return;
		}
		rows.update(items);
	});
}
