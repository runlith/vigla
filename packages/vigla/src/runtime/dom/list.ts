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
	type Batch
} from '../reactivity/batch.ts';
import { write } from '../reactivity/scheduler.ts';
import { block, branch, destroy, hide, show as unhide } from '../reactivity/effects.ts';
import type { Derived, Effect, Source } from '../reactivity/graph.ts';
import { derived, mutableEqual, mutableSource, source } from '../reactivity/sources.ts';
import { get } from '../reactivity/reads.ts';
import { owner } from '../reactivity/tracking.ts';
import { untrace } from '../reactivity/provenance.ts';
import { traceInputs, traceSource } from '../reactivity/trace.ts';
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
	animating,
	building,
	moverOf,
	pause,
	prepare,
	resume,
	type Mover
} from '../transitions/manager.ts';
import { build, buildLoose, discard, opener, place, stage, stash, type Built } from './range.ts';
import type { Render } from './template.ts';

export const MUTABLE_ROWS = 1;

export const PLAIN_ITEM = 2;

export const PLAIN_INDEX = 4;

interface Row<T> extends Built {
	readonly key: unknown;
	readonly item: Source<T> | null;
	readonly index: Source<number> | null;
	pass: number;
	at: number;
	was: number;
	shown: number;
}

export type Item<T> = (
	anchor: ChildNode,
	item: Source<T> | T,
	index: Source<number> | number
) => void;

type Collection<T> = Iterable<T> | ArrayLike<T> | null | undefined;

interface Stage<T> {
	readonly rows: readonly Row<T>[];
	readonly empty: boolean;
	readonly pass: number;
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

function kept(positions: readonly number[]): Uint8Array {
	const tails: number[] = [];
	const links = new Int32Array(positions.length);
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
	const result = new Uint8Array(positions.length);
	for (let at = tails.length > 0 ? (tails.at(-1) as number) : -1; at >= 0; at = links[at] as number)
		result[at] = 1;
	return result;
}

class List<T> {
	anchor: ChildNode;
	readonly #collection: Derived<ArrayLike<T>>;
	readonly #key: ((item: T, index: number) => unknown) | null;
	readonly #render: Item<T>;
	readonly #fallback: Render | null;
	readonly #flags: number;
	#block: Effect | null = null;
	#start: ChildNode | null = null;
	readonly #rows = new Map<unknown, Row<T>>();
	readonly #leaving = new Set<Row<T>>();
	#order: readonly Row<T>[] = [];
	#empty: Built | null = null;
	#emptyShown = false;
	#stages: Map<Batch, Stage<T>> | null = null;
	#ended: Row<T>[] | null = null;
	#staging: DocumentFragment | null = null;
	#pass = 0;
	#shown = 0;

	constructor(
		anchor: ChildNode,
		collection: Derived<ArrayLike<T>>,
		key: ((item: T, index: number) => unknown) | null,
		render: Item<T>,
		fallback: Render | null,
		flags: number
	) {
		this.anchor = anchor;
		this.#collection = collection;
		this.#key = key;
		this.#render = render;
		this.#fallback = fallback;
		this.#flags = flags;
	}

	#identify(items: ArrayLike<T>, position: number): unknown {
		if (this.#key === null) return position;
		const key = this.#key(items[position] as T, position);
		if (DEV) {
			const again = this.#key(items[position] as T, position);
			if (!Object.is(key, again)) throw volatile(position, key, again);
		}
		return key;
	}

	#create(key: unknown, value: T, position: number, pass: number, update: boolean): Row<T> {
		const flags = this.#flags;
		const item =
			(flags & PLAIN_ITEM) !== 0
				? null
				: (flags & MUTABLE_ROWS) !== 0
					? mutableSource(value)
					: source(value);
		const index = (flags & PLAIN_INDEX) !== 0 && !(DEV && item !== null) ? null : source(position);
		if (DEV && item !== null)
			traceSource(item, () => {
				const position = untrace(() => get(index as Source<number>));
				return traceInputs(this.#collection)[position];
			});
		const staging = (this.#staging ??= stage());
		const built = building(update, () =>
			buildLoose(
				staging,
				(at) => this.#render(at, item ?? value, index ?? position),
				branch,
				this.anchor
			)
		);
		const row: Row<T> = {
			key,
			item,
			index,
			effect: built.effect,
			first: built.first,
			last: built.last,
			fragment: built.fragment,
			pass,
			at: position,
			was: -1,
			shown: 0
		};
		this.#rows.set(key, row);
		return row;
	}

	#find(key: unknown, position: number, pass: number): Row<T> | undefined {
		const row = this.#rows.get(key);
		if (row !== undefined && row.pass === pass) throw duplicate(key, row.at, position);
		return row;
	}

	start(items: ArrayLike<T>): void {
		this.#block = owner;
		let adopting = false;
		let restore = false;
		if (hydrating) this.#start = this.anchor;
		else {
			this.#start = opener(this.anchor);
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
			const pass = ++this.#pass;
			const rows: Row<T>[] = [];
			for (let position = 0; position < items.length; position++) {
				const value = items[position] as T;
				const key = this.#identify(items, position);
				this.#find(key, position, pass);
				if (adopting && isClose(cursor)) {
					this.anchor = cursor;
					adopting = false;
					setHydrating(false);
					restore = true;
				}
				rows.push(this.#create(key, value, position, pass, false));
			}
			if (items.length === 0 && this.#fallback !== null) {
				this.#empty = building(false, () => build(this.#fallback as Render, branch, this.anchor));
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
		const pass = ++this.#pass;
		const rows: Row<T>[] = [];
		for (let position = 0; position < items.length; position++) {
			const value = items[position] as T;
			const key = this.#identify(items, position);
			let row = this.#find(key, position, pass);
			if (row === undefined) {
				row = this.#create(key, value, position, pass, true);
				if (batch !== null) hide(row.effect);
			} else {
				if (row.item !== null) write(row.item, value);
				if (row.index !== null) write(row.index, position);
				row.pass = pass;
				row.at = position;
			}
			rows.push(row);
		}
		const empty = items.length === 0 && this.#fallback !== null;
		if (empty && this.#empty === null) {
			this.#empty = building(true, () => build(this.#fallback as Render, branch, this.anchor));
			if (batch !== null) hide(this.#empty.effect);
		}
		const stage: Stage<T> = { rows, empty, pass };
		if (batch === null) {
			this.#capture(stage);
			this.#apply(stage);
			return;
		}
		const stages = (this.#stages ??= new Map());
		const known = stages.has(batch);
		stages.set(batch, stage);
		for (const row of this.#rows.values()) {
			if (row.pass === pass) unskip(row.effect);
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

	#selected(stage: Stage<T>): (row: Row<T>) => boolean {
		const pass = stage.pass;
		if (pass === this.#pass) return (row) => row.pass === pass;
		const selected = new Set(stage.rows);
		return (row) => selected.has(row);
	}

	#capture(stage: Stage<T>): void {
		const selected = this.#selected(stage);
		const branches: Effect[] = [];
		const retained: Effect[] = [];
		for (const row of this.#order) (selected(row) ? retained : branches).push(row.effect);
		if (this.#leaving.size > 0)
			for (const row of stage.rows) if (this.#leaving.has(row)) branches.push(row.effect);
		prepare(branches, retained);
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
		const selected = this.#selected(stage);
		const previous = this.#order;
		const shown = ++this.#shown;
		let retained = 0;
		for (let position = 0; position < previous.length; position++) {
			const row = previous[position] as Row<T>;
			if (!selected(row)) continue;
			row.was = position;
			row.shown = shown;
			retained++;
		}
		const moved: Mover[] = [];
		for (const row of next) {
			const mover = row.shown === shown ? moverOf(row.effect) : undefined;
			if (mover !== undefined) moved.push(mover);
		}
		const ended: Row<T>[] | null = retained === 0 && this.#leaving.size === 0 ? [] : null;
		this.#ended = ended;
		const still = ended !== null && !animating();
		try {
			for (const row of previous) {
				if (row.shown === shown) continue;
				if (needed?.has(row)) {
					stash(row);
					hide(row.effect);
					continue;
				}
				if (still) {
					(ended as Row<T>[]).push(row);
					if (this.#rows.get(row.key) === row) this.#rows.delete(row.key);
					continue;
				}
				moverOf(row.effect)?.fix();
				this.#leave(row);
			}
		} finally {
			this.#ended = null;
		}
		if (ended !== null) this.#clear(ended);
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
		const order = new Array<number>(next.length);
		let ordered = true;
		for (let at = 0; at < next.length; at++) {
			const row = next[at] as Row<T>;
			const position = row.shown === shown ? row.was : -1;
			order[at] = position;
			if (position < 0 || (at > 0 && position < (order[at - 1] as number))) ordered = false;
		}
		if (!ordered) {
			const stay = kept(order);
			let after = this.#start as ChildNode;
			for (let at = 0; at < next.length; at++) {
				const row = next[at] as Row<T>;
				if (stay[at] === 0) {
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
			if (this.#ended !== null) this.#ended.push(row);
			else discard(row);
			if (this.#rows.get(row.key) === row) this.#rows.delete(row.key);
		});
	}

	#clear(ended: readonly Row<T>[]): void {
		if (ended.length === 0) return;
		const parent = this.anchor.parentNode;
		const whole =
			this.#leaving.size === 0 &&
			!this.#emptyShown &&
			parent !== null &&
			parent.firstChild === this.#start &&
			parent.lastChild === this.anchor;
		if (!whole) {
			for (const row of ended) discard(row);
			return;
		}
		parent.textContent = '';
		parent.append(this.#start as ChildNode, this.anchor);
		for (const row of ended) destroy(row.effect);
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
	flags = 0
): void {
	const values = derived<ArrayLike<T>>(
		() => {
			const given = collection();
			return given == null ? [] : Array.isArray(given) ? given : Array.from(given as Iterable<T>);
		},
		(flags & MUTABLE_ROWS) !== 0 ? mutableEqual : undefined
	);
	const rows = new List<T>(node, values, key, render, fallback, flags);
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
