import { leaving, stayed } from '../reactivity/batch.ts';
import { effect, hide, show, teardown } from '../reactivity/effects.ts';
import { BLOCK, BRANCH, ROOT, type Effect } from '../reactivity/graph.ts';
import { captureLayout, LayoutContext, play, withinLayout, type LayoutPlan } from './layout.ts';
import { GEOMETRY, placementOf, type Capture } from './placement.ts';
import { owner, setOwner, untrack } from '../reactivity/tracking.ts';
import { type AnimationConfig, type Direction, type Options, type Running } from './animate.ts';

export const IN = 1;

export const OUT = 2;

export const GLOBAL = 4;

export type TransitionFn<P> = (
	element: Element,
	params: P,
	options: { direction: Direction | 'both' }
) => Options;

export type AnimateFn<P> = (
	element: Element,
	rects: { from: DOMRect; to: DOMRect },
	params: P
) => AnimationConfig;

interface Manager {
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

const managers = new WeakMap<Effect, Manager[]>();

const movers = new WeakMap<Effect, Mover>();

const transparent = new WeakSet<Effect>();

let local = true;

let allowed = true;

let live = 0;

export function seeThrough(block: Effect): void {
	transparent.add(block);
}

export function building<T>(update: boolean, fn: () => T): T {
	const previous = local;
	local = update;
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

function outside<T>(fn: () => T): T {
	const previous = setOwner(null);
	try {
		return untrack(fn);
	} finally {
		setOwner(previous);
	}
}

function dispatch(element: Element, type: string): void {
	outside(() => element.dispatchEvent(new CustomEvent(type)));
}

export function transition<P>(
	flags: number,
	element: HTMLElement,
	get: () => TransitionFn<P | undefined>,
	params: (() => P) | null
): void {
	const intro = (flags & IN) !== 0;
	const outro = (flags & OUT) !== 0;
	const global = (flags & GLOBAL) !== 0;
	const direction = intro && outro ? 'both' : intro ? 'in' : 'out';
	const inert = element.inert;
	const overflow = element.style.overflow;
	let current: Options;
	let context: LayoutContext;
	let entering: Running | undefined;
	let leaving: Running | undefined;
	const options = (target: 0 | 1): Options => {
		const next = target === 1 ? 'in' : 'out';
		if (current == null) {
			context = new LayoutContext(element, next);
			try {
				current = outside(() =>
					withinLayout(context, () => get()(element, params?.() as P, { direction }))
				);
			} catch (error) {
				context.cancel();
				throw error;
			} finally {
				context.seal();
			}
		} else context.direction = next;
		return current;
	};
	const manager: Manager = {
		element,
		global,
		in() {
			element.inert = inert;
			if (!intro) {
				leaving?.abort();
				leaving?.reset();
				leaving = current = undefined;
				return;
			}
			if (!outro) entering?.abort();
			const config = options(1);
			entering = play(
				element,
				context,
				config,
				leaving,
				1,
				() => dispatch(element, 'introstart'),
				() => {
					dispatch(element, 'introend');
					entering?.abort();
					entering = current = undefined;
					element.style.overflow = overflow;
				}
			);
		},
		out(done) {
			if (!outro) {
				done();
				current = undefined;
				return;
			}
			element.inert = true;
			const config = options(0);
			leaving = play(
				element,
				context,
				config,
				entering,
				0,
				() => dispatch(element, 'outrostart'),
				() => {
					dispatch(element, 'outroend');
					done();
				}
			);
		},
		stop() {
			entering?.abort();
			leaving?.abort();
			context?.cancel();
		}
	};
	const host = owner as Effect;
	let list = managers.get(host);
	if (list === undefined) managers.set(host, (list = []));
	list.push(manager);
	live++;
	teardown(() => {
		live--;
		manager.stop();
	});
	if (intro && allowed && (global || local)) effect(() => untrack(() => manager.in()));
}

export function animation<P>(
	element: Element,
	get: () => AnimateFn<P | undefined>,
	params: (() => P) | null
): void {
	const host = owner as Effect;
	const found = movers.get(host);
	if (found !== undefined) {
		found.element = element;
		return;
	}
	let from: Capture;
	let running: Running | undefined;
	let release: (() => void) | undefined;
	const mover: Mover = {
		element,
		measure() {
			from = captureLayout(this.element);
		},
		apply() {
			const element = this.element;
			const context = new LayoutContext(element);
			let previous = running;
			const start = from.rect;
			let end: DOMRect;
			let cancelled = false;
			const plan: LayoutPlan = {
				match() {},
				stabilize() {},
				measure() {
					if (cancelled) return;
					previous?.abort();
					previous = undefined;
					end = element.getBoundingClientRect();
					if (!still(start, end) && placementOf(element).seize(GEOMETRY)) {
						end = element.getBoundingClientRect();
					}
				},
				read() {
					if (cancelled || still(start, end)) return;
					return withinLayout(context, () =>
						get()(element, { from: start, to: end }, params?.() as P)
					);
				},
				cancel() {
					cancelled = true;
				}
			};
			context.stage(plan);
			context.seal();
			const handle = play(
				element,
				context,
				() => plan.read(),
				undefined,
				1,
				() => {},
				() => {
					if (running !== handle) return;
					handle.abort();
					running = undefined;
				}
			);
			running = handle;
		},
		fix() {
			if (release !== undefined || this.element.getAnimations().length > 0) return;
			release = placementOf(this.element).acquire(from);
		},
		unfix() {
			release?.();
			release = undefined;
		}
	};
	movers.set(host, mover);
	teardown(() => {
		running?.abort();
		mover.unfix();
	});
}

function still(a: DOMRect, b: DOMRect): boolean {
	return a.left === b.left && a.right === b.right && a.top === b.top && a.bottom === b.bottom;
}

export function moverOf(row: Effect): Mover | undefined {
	return movers.get(row);
}

export function animateMoves(moved: readonly Mover[]): void {
	for (const mover of moved) mover.apply();
}

function collect(effect: Effect, inherited: boolean, found: Manager[]): void {
	for (const manager of managers.get(effect) ?? []) {
		if (manager.global || inherited) found.push(manager);
	}
	for (let child = effect.first; child !== null; child = child.next) {
		if (child.destroyed || child.inert) continue;
		const through =
			child.kind === ROOT ||
			transparent.has(child) ||
			(child.kind === BRANCH && effect.kind === BLOCK);
		collect(child, inherited && through, found);
	}
}

export function prepare(branch: Effect): void {
	if (live > 0) {
		const found: Manager[] = [];
		collect(branch, true, found);
		for (const manager of found) captureLayout(manager.element);
	}
	movers.get(branch)?.measure();
}

export function pause(branch: Effect, done: () => void): void {
	const found: Manager[] = [];
	collect(branch, true, found);
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
	collect(branch, true, found);
	for (const manager of found) placementOf(manager.element).restore();
	for (const manager of found) manager.in();
}
