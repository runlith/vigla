import { effect, teardown } from '../reactivity/effects.ts';
import { leaving, stayed } from '../reactivity/leaving.ts';
import type { Effect } from '../reactivity/graph.ts';
import { owner, setOwner, untrack } from '../reactivity/tracking.ts';
import { sweep } from './frame.ts';
import { captureLayout, LayoutContext, play, withinLayout, type LayoutPlan } from './layout.ts';
import { capture, GEOMETRY, placementOf, type Capture } from './placement.ts';
import { type AnimationConfig, type Direction, type Options, type Running } from './animate.ts';
import { enlist, equip, moverOf, setMover, type Manager, type Mover } from './manager.ts';

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

let equipped = false;

function ready(): void {
	if (equipped) return;
	equipped = true;
	equip(
		{
			sweep,
			capture: (element) => {
				captureLayout(element);
			},
			restore: (element) => placementOf(element).restore()
		},
		{ leave: leaving, stay: stayed }
	);
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
	ready();
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
	if (enlist(manager) && intro) effect(() => untrack(() => manager.in()));
}

export function animation<P>(
	element: Element,
	get: () => AnimateFn<P | undefined>,
	params: (() => P) | null
): void {
	ready();
	const host = owner as Effect;
	const found = moverOf(host);
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
			const source = from;
			const start = source.rect;
			let end: DOMRect;
			let cancelled = false;
			const plan: LayoutPlan = {
				match() {},
				stabilize() {},
				measure() {
					if (cancelled) return;
					previous?.abort();
					previous = undefined;
					let target = capture(element);
					if (!still(start, target.rect) && placementOf(element).seize(GEOMETRY).size > 0) {
						target = capture(element);
					}
					end = target.rect;
					context.measured(source, target);
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
	setMover(host, mover);
	teardown(() => {
		running?.abort();
		mover.unfix();
	});
}

function still(a: DOMRect, b: DOMRect): boolean {
	return a.left === b.left && a.right === b.right && a.top === b.top && a.bottom === b.bottom;
}
