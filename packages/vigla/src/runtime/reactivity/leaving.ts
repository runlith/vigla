import { active, alias, excluded, open, processing, type Batch } from './batch.ts';
import { destroy, detach, detachment, fail } from './effects.ts';
import { viewOf } from './views.ts';
import {
	CLEAN,
	isDerived,
	isDestroyed,
	retainsFailures,
	type Derived,
	type Effect,
	type Failure,
	type Reaction,
	type Source
} from './graph.ts';
import { beforeOf } from './history.ts';
import { countLeaving, outgoing, selecting, setOutgoing } from './outgoing.ts';
import { running, setOwner, track, view } from './tracking.ts';

interface Entry {
	readonly epoch: Epoch;
	readonly value: unknown;
	next: Entry | null;
}

interface Chain {
	first: Entry;
	last: Entry;
}

interface Epoch {
	readonly order: number;
	readonly sources: WeakRef<Source>[];
	users: number;
	next: Epoch | null;
}

export interface Cached {
	value: unknown;
	failure: Failure | null;
	ready: boolean;
	readonly locals: Map<Source, number>;
	effects: Effect[] | null;
}

export interface LeavingView {
	readonly epoch: Epoch;
	values: WeakMap<Derived, Cached>;
	locals: WeakMap<Source, Reaction>;
	effects: Set<Effect> | null;
	computing: Derived | null;
	cache: Cached | null;
	users: number;
}

let clock = 0;
let first: Epoch | null = null;
let latest: Epoch | null = null;
let chains: WeakMap<Source, Chain> | null = null;
let commits = new WeakMap<Batch, Epoch>();
const branches = new WeakMap<Effect, LeavingView>();
const inheriting = new WeakMap<Effect, () => void>();

function append(epoch: Epoch, source: Source, value: unknown): void {
	const map = chains as WeakMap<Source, Chain>;
	const chain = map.get(source);
	if (chain !== undefined && chain.last.epoch === epoch) return;
	const entry: Entry = { epoch, value, next: null };
	if (chain === undefined) map.set(source, { first: entry, last: entry });
	else chain.last = chain.last.next = entry;
	epoch.sources.push(new WeakRef(source));
}

export function remember(source: Source, value: unknown): void {
	if (latest !== null) append(latest, source, value);
}

function start(): Epoch {
	const given = processing ?? active ?? open;
	const batch = given === null ? null : alias(given);
	const known = batch === null ? undefined : commits.get(batch);
	if (known !== undefined && known.users > 0) return known;
	const epoch: Epoch = { order: ++clock, sources: [], users: 0, next: null };
	if (latest === null) {
		chains = new WeakMap();
		first = epoch;
	} else latest.next = epoch;
	latest = epoch;
	if (batch !== null) {
		commits.set(batch, epoch);
		const before = beforeOf(batch);
		for (const [source, value] of before) append(epoch, source, value);
		const givenView = view !== null && alias(view.batch) === batch ? view : viewOf(batch);
		for (const source of givenView.hidden.keys())
			if (!before.has(source)) append(epoch, source, givenView.values.get(source));
	}
	return epoch;
}

function prune(): void {
	while (first !== null && first.users === 0) {
		const expired = first;
		first = expired.next;
		expired.next = null;
		if (first === null) {
			expired.sources.length = 0;
			latest = null;
			chains = null;
			commits = new WeakMap();
			return;
		}
		for (const ref of expired.sources) {
			const source = ref.deref();
			if (source === undefined) continue;
			const chain = chains?.get(source);
			if (chain === undefined || chain.first.epoch !== expired) continue;
			const next = chain.first.next;
			if (next === null) chains?.delete(source);
			else chain.first = next;
		}
		expired.sources.length = 0;
	}
}

function release(given: LeavingView): void {
	if (--given.users > 0) return;
	given.values = new WeakMap();
	given.locals = new WeakMap();
	const effects = given.effects;
	given.effects = null;
	given.epoch.users--;
	prune();
	for (const effect of effects ?? []) destroy(effect);
}

export function leaving(branch: Effect): () => boolean {
	stayed(branch);
	const epoch = start();
	epoch.users++;
	const given: LeavingView = {
		epoch,
		values: new WeakMap(),
		locals: new WeakMap(),
		effects: null,
		computing: null,
		cache: null,
		users: 1
	};
	branches.set(branch, given);
	countLeaving(1);
	const inherited = detachment(branch);
	if (inherited !== null) inheriting.set(branch, inherited);
	detach(branch, () => {
		stayed(branch);
		inherited?.();
	});
	return () => {
		if (branches.get(branch) !== given) return false;
		stayed(branch);
		return true;
	};
}

export function stayed(branch: Effect): void {
	const given = branches.get(branch);
	if (given === undefined) return;
	branches.delete(branch);
	countLeaving(-1);
	detach(branch, isDestroyed(branch) ? null : (inheriting.get(branch) ?? null));
	inheriting.delete(branch);
	release(given);
}

function admitted(branch: Effect): boolean {
	const reaction = running();
	if (reaction === null) return false;
	const current = processing ?? active;
	if (current === null) return false;
	const batch = alias(current);
	if (batch.shown?.has(branch) !== true || excluded(branch, batch)) return false;
	for (
		let at = isDerived(reaction) ? reaction.owner : (reaction as Effect);
		at !== null;
		at = at.parent
	)
		if (at === branch) return true;
	return false;
}

export function leavingView(derived: Derived): LeavingView | null {
	if (!selecting) return null;
	for (let at = derived.owner; at !== null; at = at.parent) {
		if (isDestroyed(at)) return null;
		const given = branches.get(at);
		if (given !== undefined) return admitted(at) ? null : given;
	}
	return null;
}

function entryOf(source: Source, epoch: Epoch): Entry | null {
	let entry = chains?.get(source)?.first ?? null;
	while (entry !== null && entry.epoch.order < epoch.order) entry = entry.next;
	return entry;
}

function unchanged(source: Derived, epoch: Epoch, seen: Set<Derived>): boolean {
	if (seen.has(source)) return true;
	seen.add(source);
	for (const dep of source.deps ?? []) {
		if (entryOf(dep, epoch) !== null) return false;
		if (isDerived(dep) && !unchanged(dep, epoch, seen)) return false;
	}
	return true;
}

function inherit(given: LeavingView, locals: ReadonlyMap<Source, number>): void {
	if (given.cache === null) return;
	for (const [source, version] of locals)
		if (given.locals.get(source) !== given.computing) given.cache.locals.set(source, version);
}

function cached(source: Derived, given: LeavingView): unknown {
	let found = given.values.get(source);
	if (found !== undefined && found.ready) {
		for (const [local, version] of found.locals)
			if (local.wv !== version) {
				found.ready = false;
				break;
			}
		if (found.ready) {
			inherit(given, found.locals);
			if (found.failure !== null) throw found.failure.error;
			return found.value;
		}
	}
	if (found === undefined) {
		found = { value: undefined, failure: null, ready: false, locals: new Map(), effects: null };
		given.values.set(source, found);
		if (
			(source.computed || source.failure !== null) &&
			source.status === CLEAN &&
			unchanged(source, given.epoch, new Set())
		) {
			found.value = source.v;
			found.failure = source.failure;
			found.ready = true;
			if (found.failure !== null) throw found.failure.error;
			return found.value;
		}
	}
	for (const effect of found.effects ?? []) {
		given.effects?.delete(effect);
		destroy(effect);
	}
	found.effects = null;
	found.failure = null;
	found.locals.clear();
	const previousCache = given.cache;
	const previousDerived = given.computing;
	const previousOwner = setOwner(source.owner);
	given.cache = found;
	given.computing = source;
	try {
		found.value = track(source, source.fn, true);
		found.ready = true;
		return found.value;
	} catch (error) {
		if (source.owner === null) throw error;
		if (!isDestroyed(source.owner)) fail(source.owner, error);
		found.value = undefined;
		found.ready = true;
		if (!retainsFailures(source)) return undefined;
		found.failure = { error };
		throw error;
	} finally {
		given.cache = previousCache;
		given.computing = previousDerived;
		setOwner(previousOwner);
		inherit(given, found.locals);
	}
}

function read(source: Source, given: LeavingView): unknown {
	const local = given.locals.get(source);
	if (local !== undefined) {
		if (given.cache !== null && local !== given.computing)
			given.cache.locals.set(source, source.wv);
		return source.v;
	}
	const entry = entryOf(source, given.epoch);
	if (entry !== null) return entry.value;
	return isDerived(source) ? cached(source, given) : source.v;
}

export function readLeaving(source: Source, given: LeavingView): unknown {
	if (outgoing === given) return read(source, given);
	const previous = setOutgoing(given);
	given.users++;
	try {
		return read(source, given);
	} finally {
		setOutgoing(previous);
		release(given);
	}
}
