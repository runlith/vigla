import { active, alias, processed, type Batch } from './batch.ts';
import { BLOCK, BRANCH, type Derived, type Effect, type Reaction } from './graph.ts';
import { deriving, view } from './tracking.ts';

export interface Draft {
	readonly batch: Batch;
	readonly speculative: boolean;
	readonly children: Set<Effect>;
	created: Set<Derived> | null;
	teardown: (() => void) | null;
	signal: AbortController | undefined;
}

const drafts = new WeakMap<Reaction, Draft[]>();
const drafted = new WeakMap<Batch, Set<Reaction>>();
const origins = new WeakMap<Derived, Draft>();
const homes = new WeakMap<Effect, Draft>();
const none: readonly Draft[] = [];
export let drafting = 0;

export function admit(draft: Draft, effect: Effect): void {
	draft.children.add(effect);
	homes.set(effect, draft);
}

export function heldBy(effect: Effect): Batch | null {
	const draft = homes.get(effect);
	if (draft === undefined) return null;
	const batch = alias(draft.batch);
	return batch.done ? null : batch;
}

export function heldAbove(effect: Effect): Batch | null {
	for (let at: Effect | null = effect; at !== null; at = at.parent) {
		const found = heldBy(at);
		if (found !== null) return found;
	}
	return null;
}

export function draftOf(reaction: Reaction, batch: Batch): Draft | undefined {
	for (const draft of drafts.get(reaction) ?? none) if (draft.batch === batch) return draft;
	return undefined;
}

export function draftsOf(reaction: Reaction): readonly Draft[] {
	return drafts.get(reaction) ?? none;
}

export function draftedIn(batch: Batch): ReadonlySet<Reaction> | undefined {
	return drafted.get(batch);
}

export function closing(batch: Batch): ReadonlySet<Reaction> | undefined {
	const reactions = drafted.get(batch);
	drafted.delete(batch);
	return reactions;
}

export function enlist(reaction: Reaction, draft: Draft): boolean {
	const found = drafts.get(reaction);
	if (found === undefined) drafts.set(reaction, [draft]);
	else found.push(draft);
	drafting++;
	const reactions = drafted.get(draft.batch);
	if (reactions !== undefined) {
		reactions.add(reaction);
		return false;
	}
	drafted.set(draft.batch, new Set([reaction]));
	return true;
}

export function take(reaction: Reaction, draft: Draft): void {
	const found = drafts.get(reaction) ?? [];
	const index = found.indexOf(draft);
	if (index === -1) return;
	found.splice(index, 1);
	if (found.length === 0) drafts.delete(reaction);
	drafting--;
	for (const derived of draft.created ?? []) origins.delete(derived);
	for (const child of draft.children) if (homes.get(child) === draft) homes.delete(child);
}

export function inDrafts(found: readonly Draft[], effect: Effect): boolean {
	for (const draft of found) if (draft.children.has(effect)) return true;
	return false;
}

export function createdBy(found: readonly Draft[], derived: Derived): boolean {
	for (const draft of found) if (draft.created?.has(derived)) return true;
	return false;
}

function runningFor(): Batch | null {
	return view?.batch ?? active ?? processed();
}

function runningDraft(reaction: Reaction): Draft | undefined {
	const batch = runningFor();
	if (batch === null) return undefined;
	const cohort = alias(batch);
	for (const draft of drafts.get(reaction) ?? none) if (alias(draft.batch) === cohort) return draft;
	return undefined;
}

export function capture(parent: Effect, effect: Effect, claimer: Derived | null): void {
	if (claimer !== null) {
		const origin = origins.get(claimer);
		if (origin !== undefined) admit(origin, effect);
		return;
	}
	if (parent.kind === BLOCK && effect.kind === BRANCH) return;
	const draft = runningDraft(parent);
	if (draft !== undefined) admit(draft, effect);
}

export function ownDerived(derived: Derived): void {
	const holder = derived.owner;
	if (drafting === 0 || holder === null) return;
	const evaluating = deriving();
	const draft = evaluating !== null ? origins.get(evaluating) : runningDraft(holder);
	if (draft === undefined) return;
	(draft.created ??= new Set()).add(derived);
	origins.set(derived, draft);
}
