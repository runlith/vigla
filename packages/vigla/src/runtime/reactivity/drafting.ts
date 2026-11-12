import { restoreSignal, takeSignal } from './abort.ts';
import { alias, type Batch } from './batch.ts';
import {
	admit,
	capture,
	closing,
	createdBy,
	draftOf,
	drafting,
	draftedIn,
	draftsOf,
	enlist,
	heldAbove,
	heldBy,
	inDrafts,
	ownDerived,
	take,
	type Draft
} from './drafts.ts';
import {
	destroy,
	destroyChildren,
	disconnect,
	dispose,
	drafter,
	freeze,
	setDrafter,
	type Aside,
	type Drafter
} from './effects.ts';
import {
	BLOCK,
	isDerived,
	isDestroyed,
	type Derived,
	type Effect,
	type Reaction
} from './graph.ts';

function register(reaction: Reaction, draft: Draft): void {
	const batch = draft.batch;
	if (!enlist(reaction, draft)) return;
	(batch.settles ??= []).push(() => close(batch));
	batch.commits.push({ apply: () => adopt(batch) });
}

function drop(reaction: Reaction, draft: Draft): void {
	take(reaction, draft);
	const parent = isDerived(reaction) ? reaction.owner : (reaction as Effect);
	if (parent !== null) destroyChildren(parent, false, (child) => draft.children.has(child));
	for (const child of draft.children) destroy(child);
	const created = draft.created;
	if (created !== null) {
		const holder = reaction as Effect;
		const owned = holder.owned?.filter((derived) => !created.has(derived)) ?? [];
		holder.owned = owned.length === 0 ? null : owned;
		for (const derived of created) disconnect(derived);
	}
	if (draft.teardown !== null) dispose(reaction as Effect, draft.teardown);
}

function dropAll(reaction: Reaction): void {
	for (const draft of [...draftsOf(reaction)]) drop(reaction, draft);
}

function close(batch: Batch): void {
	const cohort = alias(batch);
	for (const reaction of closing(batch) ?? []) {
		if (!cohort.discarded && isDerived(reaction)) {
			install(reaction, cohort);
			continue;
		}
		const draft = draftOf(reaction, batch);
		if (draft !== undefined) drop(reaction, draft);
	}
}

function install(derived: Derived, cohort: Batch): void {
	const found = draftsOf(derived).filter((draft) => alias(draft.batch) === cohort);
	const latest = found.pop();
	if (latest === undefined) return;
	for (const draft of found) drop(derived, draft);
	take(derived, latest);
	const replaced = derived.effects;
	const effects = [...latest.children].filter((effect) => !isDestroyed(effect));
	derived.effects = effects.length === 0 ? null : effects;
	derived.frozen = null;
	restoreSignal(derived, latest.signal);
	for (const effect of replaced ?? []) destroy(effect);
	if (derived.reactions === null) freeze(derived);
}

function adopt(batch: Batch): void {
	for (const reaction of draftedIn(batch) ?? []) {
		if (isDerived(reaction)) continue;
		const effect = reaction as Effect;
		const draft = draftOf(effect, batch);
		if (draft === undefined || isDestroyed(effect)) continue;
		if (!draft.speculative || effect.batch === batch.order) promote(effect, draft);
	}
}

function promote(effect: Effect, draft: Draft): void {
	take(effect, draft);
	restoreSignal(effect, draft.signal);
	const found = [draft, ...draftsOf(effect)];
	destroyChildren(effect, effect.kind === BLOCK, (child) => !inDrafts(found, child));
	const owned = effect.owned;
	effect.owned = null;
	for (const derived of owned ?? []) {
		if (createdBy(found, derived)) (effect.owned ??= []).push(derived);
		else disconnect(derived);
	}
	const teardown = effect.teardown;
	effect.teardown = draft.teardown;
	if (teardown !== null) dispose(effect, teardown);
}

function discardAside(derived: Derived, aside: Aside): void {
	for (const effect of aside.effects ?? []) destroy(effect);
	if (drafting !== 0) dropAll(derived);
}

function restoreAside(derived: Derived, aside: Aside, batch: Batch): void {
	if (batch.done && !alias(batch).discarded) return discardAside(derived, aside);
	const children = derived.effects ?? [];
	const signal = takeSignal(derived);
	derived.effects = aside.effects;
	derived.frozen = aside.frozen;
	restoreSignal(derived, aside.signal);
	const previous = draftOf(derived, batch);
	if (batch.done) for (const child of children) destroy(child);
	else if (children.length > 0) {
		const draft: Draft = {
			batch,
			speculative: batch.fork,
			children: new Set(),
			created: null,
			teardown: null,
			signal
		};
		for (const child of children) admit(draft, child);
		register(derived, draft);
	}
	if (previous !== undefined) drop(derived, previous);
}

function begin(effect: Effect, batch: Batch): Draft {
	if (!batch.fork) dropAll(effect);
	else {
		const previous = draftOf(effect, batch);
		if (previous !== undefined) drop(effect, previous);
	}
	const draft: Draft = {
		batch,
		speculative: batch.fork,
		children: new Set(),
		created: null,
		teardown: null,
		signal: undefined
	};
	register(effect, draft);
	return draft;
}

const hooks: Drafter = {
	begin,
	dropAll,
	capture,
	ownDerived,
	discardAside,
	restoreAside,
	heldBy,
	heldAbove
};

export function useDrafts(): void {
	if (drafter === null) setDrafter(hooks);
}
