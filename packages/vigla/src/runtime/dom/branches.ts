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
import { hide, show as unhide } from '../reactivity/effects.ts';
import type { Effect } from '../reactivity/graph.ts';
import { owner } from '../reactivity/tracking.ts';
import { building, pause, prepare, resume, seeThrough } from '../transitions/manager.ts';
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
	readonly #transparent: boolean;
	#block: Effect | null = null;
	#shown!: K;
	readonly #built = new Map<K, Built>();
	readonly #leaving = new Set<K>();
	#stages: Map<Batch, K> | null = null;

	constructor(anchor: ChildNode, transparent = false) {
		this.anchor = anchor;
		this.#transparent = transparent;
	}

	#build(render: Render, update: boolean): Built {
		return this.#transparent ? build(render) : building(update, () => build(render));
	}

	start(key: K, render: Render | null, matched: boolean | null = null, end: Ending = CLOSED): void {
		this.#block = owner;
		if (this.#transparent && owner !== null) seeThrough(owner);
		this.#shown = key;
		let built: Built | null = null;
		if (!hydrating) {
			built = render === null ? null : this.#build(render, false);
			if (built !== null) place(built, this.anchor);
		} else if (matched === null) {
			cursor.before(document.createTextNode(''));
			built = render === null ? null : this.#build(render, false);
			this.anchor = cursor;
		} else {
			claim(this.anchor.nextSibling);
			if (matched) {
				built = render === null ? null : this.#build(render, false);
				this.anchor = ending(end);
			} else {
				this.anchor = removeServer();
				setHydrating(false);
				try {
					built = render === null ? null : this.#build(render, false);
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
		if (!known && same(key, this.#shown) && (stages === null || stages.size === 0)) return;
		if (!this.#built.has(key) && !same(key, this.#shown)) {
			const content = render();
			if (content !== null) {
				const built = this.#build(content, true);
				if (batch !== null) hide(built.effect);
				this.#built.set(key, built);
			}
		}
		if (batch === null) {
			this.#capture(key);
			this.#switch(key);
			return;
		}
		(this.#stages ??= new Map()).set(batch, key);
		for (const [held, built] of this.#built) {
			if (same(held, key)) unskip(built.effect);
			else skip(built.effect);
		}
		if (known) return;
		atCommit({ prepare: () => this.#prepare(batch), apply: () => this.#commit(batch) });
		atDiscard(() => this.#discard(batch));
		atMerge((from, into) => this.#merge(from, into));
	}

	#merge(from: Batch, into: Batch): void {
		const stages = this.#stages;
		if (stages === null || !stages.has(from)) return;
		const key = stages.get(from) as K;
		stages.delete(from);
		if (from.order > into.order || !stages.has(into)) stages.set(into, key);
	}

	#capture(key: K): void {
		if (same(key, this.#shown)) return;
		const old = this.#built.get(this.#shown);
		if (old !== undefined) prepare(old.effect);
		const revived = this.#leaving.has(key) ? this.#built.get(key) : undefined;
		if (revived !== undefined) prepare(revived.effect);
	}

	#prepare(given: Batch): void {
		const stages = this.#stages;
		const batch = alias(given);
		if (stages === null || !stages.has(batch) || this.#block?.destroyed === true) return;
		this.#capture(stages.get(batch) as K);
	}

	#commit(given: Batch): void {
		const batch = alias(given);
		const stages = this.#stages;
		if (stages === null || !stages.has(batch) || this.#block?.destroyed === true) return;
		const key = stages.get(batch) as K;
		stages.delete(batch);
		this.#switch(key);
	}

	#discard(given: Batch): void {
		const batch = alias(given);
		if (this.#stages?.delete(batch) !== true || this.#block?.destroyed === true) return;
		this.#prune();
	}

	#switch(key: K): void {
		const previous = this.#shown;
		if (!same(previous, key)) {
			this.#shown = key;
			const next = this.#built.get(key);
			if (next !== undefined) {
				if (this.#leaving.delete(key)) resume(next.effect);
				else {
					place(next, this.anchor);
					unhide(next.effect);
				}
			}
			const old = this.#built.get(previous);
			if (old !== undefined) {
				if (this.#needed(previous)) {
					stash(old);
					hide(old.effect);
				} else this.#leave(previous, old);
			}
		}
		this.#prune();
	}

	#leave(key: K, built: Built): void {
		this.#leaving.add(key);
		pause(built.effect, () => {
			if (!this.#leaving.delete(key) || this.#block?.destroyed === true) return;
			if (this.#needed(key)) {
				stash(built);
				return;
			}
			discard(built);
			this.#built.delete(key);
		});
	}

	#needed(key: K): boolean {
		for (const held of this.#stages?.values() ?? []) if (same(held, key)) return true;
		return false;
	}

	#prune(): void {
		for (const [key, built] of this.#built) {
			if (same(key, this.#shown) || this.#leaving.has(key) || this.#needed(key)) continue;
			discard(built);
			this.#built.delete(key);
		}
	}
}
