import { leaving, stayed } from '../reactivity/batch.ts';
import { effect, hide, show } from '../reactivity/effects.ts';
import { BLOCK, BRANCH, ROOT, type Effect } from '../reactivity/graph.ts';
import { task } from '../reactivity/tasks.ts';
import { owner, setOwner, untrack } from '../reactivity/tracking.ts';
import {
	animate,
	type AnimationConfig,
	type Direction,
	type Options,
	type Running
} from './animate.ts';

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
	let entering: Running | undefined;
	let leaving: Running | undefined;
	const options = (): Options =>
		(current ??= outside(() => get()(element, params?.() as P, { direction })));
	const manager: Manager = {
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
			entering = animate(
				element,
				options(),
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
			leaving = animate(
				element,
				options(),
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
		}
	};
	const host = owner as Effect;
	let list = managers.get(host);
	if (list === undefined) managers.set(host, (list = []));
	list.push(manager);
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
	let from: DOMRect;
	let running: Running | undefined;
	let original: { position: string; width: string; height: string; transform: string } | null =
		null;
	const mover: Mover = {
		element,
		measure() {
			from = this.element.getBoundingClientRect();
		},
		apply() {
			running?.abort();
			const to = this.element.getBoundingClientRect();
			if (
				from.left === to.left &&
				from.right === to.right &&
				from.top === to.top &&
				from.bottom === to.bottom
			) {
				return;
			}
			const config = get()(this.element, { from, to }, params?.() as P);
			running = animate(
				this.element,
				config,
				undefined,
				1,
				() => {},
				() => {
					running?.abort();
					running = undefined;
				}
			);
		},
		fix() {
			const target = this.element as HTMLElement;
			if (target.getAnimations().length > 0) return;
			const { position, width, height } = getComputedStyle(target);
			if (position === 'absolute' || position === 'fixed') return;
			const style = target.style;
			original = {
				position: style.position,
				width: style.width,
				height: style.height,
				transform: style.transform
			};
			style.position = 'absolute';
			style.width = width;
			style.height = height;
			const to = target.getBoundingClientRect();
			if (from.left !== to.left || from.top !== to.top) {
				const shift = `translate(${from.left - to.left}px, ${from.top - to.top}px)`;
				style.transform = style.transform ? `${style.transform} ${shift}` : shift;
			}
		},
		unfix() {
			if (original === null) return;
			const style = (this.element as HTMLElement).style;
			style.position = original.position;
			style.width = original.width;
			style.height = original.height;
			style.transform = original.transform;
			original = null;
		}
	};
	movers.set(host, mover);
}

export function moverOf(row: Effect): Mover | undefined {
	return movers.get(row);
}

export function animateMoves(moved: readonly Mover[]): void {
	if (moved.length === 0) return;
	task(() => {
		for (const mover of moved) mover.apply();
	});
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
			if (--remaining === 0 && release()) done();
		});
	}
}

export function resume(branch: Effect): void {
	stayed(branch);
	show(branch);
	const found: Manager[] = [];
	collect(branch, true, found);
	for (const manager of found) manager.in();
}
