import { leaving, stayed } from '../reactivity/leaving.ts';
import { hide, show, teardown } from '../reactivity/effects.ts';
import { BLOCK, BRANCH, ROOT, isDestroyed, isInert, type Effect } from '../reactivity/graph.ts';
import { owner } from '../reactivity/tracking.ts';

export interface Manager {
	readonly element: Element;
	readonly global: boolean;
	in(): void;
	out(done: () => void): void;
	stop(): void;
}

export interface Mover {
	element: Element;
	measure(): void;
	apply(): void;
	fix(): void;
	unfix(): void;
}

export interface Geometry {
	sweep<T>(fn: () => T): T;
	capture(element: Element): void;
	restore(element: Element): void;
}

const managers = new WeakMap<Effect, Manager[]>();

const movers = new WeakMap<Effect, Mover>();

const transparent = new WeakSet<Effect>();

let local = true;

let allowed = true;

let live = 0;

let geometry: Geometry | null = null;

export function equip(given: Geometry): void {
	geometry = given;
}

export function animating(): boolean {
	return geometry !== null;
}

export function seeThrough(block: Effect): void {
	transparent.add(block);
}

export function setBuilding(update: boolean): boolean {
	const previous = local;
	local = update;
	return previous;
}

export function building<T>(update: boolean, fn: () => T): T {
	const previous = setBuilding(update);
	try {
		return fn();
	} finally {
		local = previous;
	}
}

export function introducing<T>(intro: boolean, fn: () => T): T {
	const previous = allowed;
	allowed = intro;
	try {
		return fn();
	} finally {
		allowed = previous;
	}
}

export function enlist(manager: Manager): boolean {
	const host = owner as Effect;
	let list = managers.get(host);
	if (list === undefined) managers.set(host, (list = []));
	list.push(manager);
	live++;
	teardown(() => {
		live--;
		manager.stop();
	});
	return allowed && (manager.global || local);
}

export function moverOf(row: Effect): Mover | undefined {
	return movers.get(row);
}

export function setMover(host: Effect, mover: Mover): void {
	movers.set(host, mover);
}

export function animateMoves(moved: readonly Mover[]): void {
	for (const mover of moved) mover.apply();
}

function collect(effect: Effect, inherited: boolean, found: Manager[]): void {
	for (const manager of managers.get(effect) ?? []) {
		if (manager.global || inherited) found.push(manager);
	}
	for (let child = effect.first; child !== null; child = child.next) {
		if (isDestroyed(child) || isInert(child)) continue;
		const through =
			child.kind === ROOT ||
			transparent.has(child) ||
			(child.kind === BRANCH && effect.kind === BLOCK);
		collect(child, inherited && through, found);
	}
}

export function prepare(branches: readonly Effect[], retained: readonly Effect[] = []): void {
	const measuring = geometry;
	if (measuring === null) return;
	measuring.sweep(() => {
		for (const branch of branches) {
			if (live > 0) {
				const found: Manager[] = [];
				collect(branch, true, found);
				for (const manager of found) measuring.capture(manager.element);
			}
			movers.get(branch)?.measure();
		}
		for (const row of retained) movers.get(row)?.measure();
	});
}

export function pause(branch: Effect, done: () => void): void {
	const found: Manager[] = [];
	if (live > 0) collect(branch, true, found);
	hide(branch);
	let remaining = found.length;
	if (remaining === 0) {
		done();
		return;
	}
	const release = leaving(branch);
	for (const manager of found) {
		manager.out(() => {
			if (--remaining !== 0 || !release()) return;
			for (const manager of found) manager.stop();
			done();
		});
	}
}

export function resume(branch: Effect): void {
	stayed(branch);
	show(branch);
	const found: Manager[] = [];
	if (live > 0) collect(branch, true, found);
	for (const manager of found) geometry?.restore(manager.element);
	for (const manager of found) manager.in();
}
