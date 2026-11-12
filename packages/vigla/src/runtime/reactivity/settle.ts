import { concealed, excluded, handOver, type Batch } from './batch.ts';
import { drafting } from './drafts.ts';
import { drafter, escape, run, type Drafter } from './effects.ts';
import { CLEAN, DESTROYED, DIRTY, RUNNING, isDestroyed, isInert, type Effect } from './graph.ts';
import { instantly } from './past.ts';
import { stale } from './reads.ts';

export let eager: Set<Effect> | null = null;

export function due(effect: Effect, recheck = false, batch: Batch | null = null): boolean {
	try {
		const run = recheck ? batch?.runs?.get(effect) : undefined;
		const dirty = run === undefined ? stale(effect, recheck) : run.stale();
		if (!dirty) effect.status = CLEAN;
		return dirty;
	} catch (error) {
		effect.status = CLEAN;
		escape(effect, error);
		return false;
	}
}

function blocks(marked: Set<Effect>, batch: Batch): void {
	instantly(() => {
		for (const block of marked) {
			const ordered = [block];
			for (let at = block.parent; at !== null; at = at.parent)
				if (marked.delete(at)) ordered.push(at);
			for (let index = ordered.length - 1; index >= 0; index--) {
				const effect = ordered[index] as Effect;
				if (isDestroyed(effect) || excluded(effect, batch)) continue;
				const holder = drafting === 0 ? null : (drafter as Drafter).heldAbove(effect);
				if (holder !== null && holder !== batch) handOver(effect, holder);
				else if (due(effect)) run(effect);
			}
		}
	});
}

export function settle(
	effects: readonly Effect[],
	force: boolean,
	batch: Batch,
	leftover: Effect[]
): void {
	const outer = eager;
	let marked: Set<Effect> | null = null;
	let index = 0;
	try {
		for (; index < effects.length; index++) {
			const effect = effects[index] as Effect;
			if ((effect.flags & (DESTROYED | RUNNING)) !== 0) continue;
			if (batch.skipped !== null || concealed > 0 ? excluded(effect, batch) : isInert(effect))
				continue;
			const recheck = batch.forced?.delete(effect) === true;
			if (!due(effect, force || recheck, batch)) continue;
			eager = marked ??= new Set();
			run(effect);
			eager = outer;
			if (marked.size === 0) continue;
			blocks(marked, batch);
			marked.clear();
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
