import { excluded, type Batch } from './batch.ts';
import { offscreen, run } from './effects.ts';
import { CLEAN, DIRTY, type Effect } from './graph.ts';
import { stale } from './tracking.ts';

export let eager: Set<Effect> | null = null;
export let instant = false;

export function due(effect: Effect): boolean {
	try {
		return stale(effect);
	} catch (error) {
		effect.status = CLEAN;
		throw error;
	}
}

function blocks(marked: Set<Effect>, batch: Batch): void {
	const outer = instant;
	instant = true;
	try {
		for (const block of marked) {
			const ordered = [block];
			for (let at = block.parent; at !== null; at = at.parent)
				if (marked.delete(at)) ordered.push(at);
			for (let index = ordered.length - 1; index >= 0; index--) {
				const effect = ordered[index] as Effect;
				if (effect.destroyed || excluded(effect, batch)) continue;
				if (due(effect)) run(effect);
			}
		}
	} finally {
		instant = outer;
	}
}

export function settle(
	effects: readonly Effect[],
	force: boolean,
	batch: Batch,
	leftover: Effect[]
): void {
	const outer = eager;
	let index = 0;
	try {
		for (; index < effects.length; index++) {
			const effect = effects[index] as Effect;
			if (effect.destroyed || effect.running) continue;
			if (batch.skipped !== null || offscreen.size > 0 ? excluded(effect, batch) : effect.inert)
				continue;
			if (force) effect.status = DIRTY;
			if (!due(effect)) continue;
			const marked = new Set<Effect>();
			eager = marked;
			run(effect);
			eager = outer;
			if (marked.size > 0) blocks(marked, batch);
		}
	} catch (error) {
		eager = outer;
		for (let rest = index + 1; rest < effects.length; rest++) {
			const effect = effects[rest] as Effect;
			if (force) effect.status = DIRTY;
			leftover.push(effect);
		}
		throw error;
	}
}
