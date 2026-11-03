import { isDerived, type Derived, type Reaction, type Source } from './graph.ts';

export interface Observers {
	observed(derived: Derived): void;
	unobserved(derived: Derived): void;
}

let observers: Observers = { observed() {}, unobserved() {} };

export function observe(given: Observers): void {
	observers = given;
}

export function depsOf(reaction: Reaction): Source[] {
	let deps = reaction.deps;
	if (deps === null) {
		reaction.deps = deps = [];
		reaction.slots = [];
	}
	return deps;
}

function link(dep: Source, reaction: Reaction, at: number): number {
	const reactions = dep.reactions;
	if (reactions !== null) {
		(dep.links as number[]).push(at);
		return reactions.push(reaction) - 1;
	}
	dep.reactions = [reaction];
	dep.links = [at];
	if (isDerived(dep) && dep.frozen !== null) observers.observed(dep);
	return 0;
}

function subscribe(dep: Source, reaction: Reaction): void {
	const slots = reaction.slots as number[];
	slots.push(link(dep, reaction, slots.length));
}

function subscribeAll(reaction: Reaction, deps: Source[]): void {
	const slots = new Array<number>(deps.length);
	reaction.slots = slots;
	for (let index = 0; index < deps.length; index++)
		slots[index] = link(deps[index] as Source, reaction, index);
}

function place(dep: Source, reaction: Reaction, slot: number): void {
	const slots = reaction.slots as number[];
	(dep.links as number[])[slot] = slots.length;
	slots.push(slot);
}

function cut(dep: Source, slot: number, emptied: Derived[] | null): Derived[] | null {
	const reactions = dep.reactions as Reaction[];
	const links = dep.links as number[];
	const last = reactions.length - 1;
	if (last === 0) {
		dep.reactions = dep.links = null;
		if (isDerived(dep) && dep.effects !== null) (emptied ??= []).push(dep);
		return emptied;
	}
	if (slot !== last) {
		const moved = reactions[last] as Reaction;
		const link = links[last] as number;
		reactions[slot] = moved;
		links[slot] = link;
		(moved.slots as number[])[link] = slot;
	}
	reactions.pop();
	links.pop();
	return emptied;
}

function freezeUnread(emptied: Derived[] | null): void {
	if (emptied === null) return;
	for (const derived of emptied) if (derived.reactions === null) observers.unobserved(derived);
}

export function add(reaction: Reaction, dep: Source): void {
	const deps = depsOf(reaction);
	if (deps.includes(dep)) return;
	deps.push(dep);
	subscribe(dep, reaction);
}

export function unsubscribe(reaction: Reaction): void {
	const deps = reaction.deps;
	const slots = reaction.slots as number[];
	reaction.deps = reaction.slots = null;
	if (deps === null) return;
	let emptied: Derived[] | null = null;
	for (let index = 0; index < deps.length; index++)
		emptied = cut(deps[index] as Source, slots[index] as number, emptied);
	freezeUnread(emptied);
}

export function truncate(reaction: Reaction, length: number): void {
	const deps = reaction.deps as Source[];
	const slots = reaction.slots as number[];
	let emptied: Derived[] | null = null;
	for (let index = length; index < deps.length; index++)
		emptied = cut(deps[index] as Source, slots[index] as number, emptied);
	deps.length = slots.length = length;
	freezeUnread(emptied);
}

export function retainDeps(reaction: Reaction, reads: ReadonlySet<Source>): void {
	const deps = reaction.deps as Source[];
	const slots = reaction.slots as number[];
	let emptied: Derived[] | null = null;
	let count = 0;
	for (let index = 0; index < deps.length; index++) {
		const dep = deps[index] as Source;
		const slot = slots[index] as number;
		if (!reads.has(dep)) {
			emptied = cut(dep, slot, emptied);
			continue;
		}
		deps[count] = dep;
		slots[count] = slot;
		(dep.links as number[])[slot] = count++;
	}
	deps.length = slots.length = count;
	freezeUnread(emptied);
}

export function extend(
	target: Reaction,
	matched: number,
	extra: Source[],
	keep: boolean,
	version: number
): number {
	const old = target.deps;
	const taken = version + 2;
	const tail = version + 1;
	if (old !== null) {
		for (let index = 0; index < matched; index++) (old[index] as Source).read = taken;
		for (let index = matched; index < old.length; index++) (old[index] as Source).read = tail;
	}
	let count = 0;
	for (let index = 0; index < extra.length; index++) {
		const dep = extra[index] as Source;
		const mark = dep.read;
		if (mark === taken) continue;
		dep.read = taken;
		if (mark === tail && keep) continue;
		extra[count++] = dep;
	}
	extra.length = count;
	if (old === null) {
		target.deps = extra;
		subscribeAll(target, extra);
		return count;
	}
	if (keep) {
		for (const dep of extra) {
			old.push(dep);
			subscribe(dep, target);
		}
		return count;
	}
	const slots = target.slots as number[];
	let emptied: Derived[] | null = null;
	for (let index = matched; index < old.length; index++) {
		const dep = old[index] as Source;
		const slot = slots[index] as number;
		if (dep.read === tail) emptied = cut(dep, slot, emptied);
		else dep.read = -1 - slot;
	}
	slots.length = matched;
	if (matched === 0) target.deps = extra;
	else old.length = matched;
	for (const dep of extra) {
		if (matched !== 0) old.push(dep);
		const mark = dep.read;
		if (mark >= 0) subscribe(dep, target);
		else {
			dep.read = taken;
			place(dep, target, -1 - mark);
		}
	}
	freezeUnread(emptied);
	return count;
}

export function rebuild(target: Reaction, kept: Set<Source>, keep: boolean): void {
	const previous = target.deps;
	const slots = target.slots as number[];
	const placed = new Map<Source, number>();
	let emptied: Derived[] | null = null;
	if (previous !== null) {
		for (let index = 0; index < previous.length; index++) {
			const dep = previous[index] as Source;
			const slot = slots[index] as number;
			if (keep) kept.add(dep);
			if (kept.has(dep)) placed.set(dep, slot);
			else emptied = cut(dep, slot, emptied);
		}
	}
	const deps = [...kept];
	target.deps = deps;
	target.slots = [];
	for (const dep of deps) {
		const slot = placed.get(dep);
		if (slot === undefined) subscribe(dep, target);
		else place(dep, target, slot);
	}
	freezeUnread(emptied);
}
