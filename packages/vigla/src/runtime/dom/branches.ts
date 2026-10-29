import { atCommit, atDiscard, processed, skip, unskip, type Batch } from '../reactivity/batch.ts';
import type { Effect } from '../reactivity/graph.ts';
import { owner } from '../reactivity/tracking.ts';
import {
	claim,
	COMMENT,
	cursor,
	hydrating,
	isClose,
	mismatch,
	setHydrating,
	skip as removeServer
} from './hydration.ts';
import { build, discard, place, stash, type Built } from './range.ts';
import type { Render } from './template.ts';

export function same(a: unknown, b: unknown): boolean {
	return a === b || (a !== a && b !== b);
}

export const CLOSED = 0;

export const REPAIRED = 1;

export const COMMENTED = 2;

export type Ending = typeof CLOSED | typeof REPAIRED | typeof COMMENTED;

function ending(end: Ending): ChildNode {
	if (end === COMMENTED) {
		if (cursor.nodeType !== COMMENT) mismatch();
		return cursor;
	}
	if (isClose(cursor)) return cursor;
	if (end === CLOSED) mismatch();
	return removeServer();
}

export class Branches<K> {
	anchor: ChildNode;
	#block: Effect | null = null;
	#shown: K | undefined = undefined;
	readonly #built = new Map<K, Built>();
	#stages: Map<Batch, K> | null = null;

	constructor(anchor: ChildNode) {
		this.anchor = anchor;
	}

	start(key: K, render: Render | null, matched: boolean | null = null, end: Ending = CLOSED): void {
		this.#block = owner;
		this.#shown = key;
		let built: Built | null = null;
		if (!hydrating) {
			built = render === null ? null : build(render);
			if (built !== null) place(built, this.anchor);
		} else if (matched === null) {
			cursor.before(document.createTextNode(''));
			built = render === null ? null : build(render);
			this.anchor = cursor;
		} else {
			claim(this.anchor.nextSibling);
			if (matched) {
				built = render === null ? null : build(render);
				this.anchor = ending(end);
			} else {
				this.anchor = removeServer();
				setHydrating(false);
				try {
					built = render === null ? null : build(render);
				} finally {
					setHydrating(true);
				}
				if (built !== null) place(built, this.anchor);
			}
		}
		if (built !== null) this.#built.set(key, built);
	}

	show(key: K, render: () => Render | null): void {
		const batch = processed();
		const stages = this.#stages;
		const known = batch !== null && stages !== null && stages.has(batch);
		if (!known && same(key, this.#shown)) return;
		if (!this.#built.has(key) && !same(key, this.#shown)) {
			const content = render();
			if (content !== null) this.#built.set(key, build(content));
		}
		if (batch === null) {
			this.#switch(key);
			return;
		}
		(this.#stages ??= new Map()).set(batch, key);
		for (const [held, built] of this.#built) {
			if (same(held, key)) unskip(built.effect);
			else skip(built.effect);
		}
		if (known) return;
		atCommit(() => this.#commit(batch));
		atDiscard(() => this.#discard(batch));
	}

	#commit(batch: Batch): void {
		const stages = this.#stages;
		if (stages === null || !stages.has(batch) || this.#block?.destroyed === true) return;
		const key = stages.get(batch) as K;
		stages.delete(batch);
		this.#switch(key);
	}

	#discard(batch: Batch): void {
		if (this.#stages?.delete(batch) !== true || this.#block?.destroyed === true) return;
		this.#prune();
	}

	#switch(key: K): void {
		const previous = this.#shown;
		if (!same(previous, key)) {
			this.#shown = key;
			const next = this.#built.get(key);
			if (next !== undefined) place(next, this.anchor);
			const old = previous === undefined ? undefined : this.#built.get(previous);
			if (old !== undefined) {
				if (this.#needed(previous as K)) stash(old);
				else {
					discard(old);
					this.#built.delete(previous as K);
				}
			}
		}
		this.#prune();
	}

	#needed(key: K): boolean {
		for (const held of this.#stages?.values() ?? []) if (same(held, key)) return true;
		return false;
	}

	#prune(): void {
		for (const [key, built] of this.#built) {
			if (same(key, this.#shown) || this.#needed(key)) continue;
			discard(built);
			this.#built.delete(key);
		}
	}
}
