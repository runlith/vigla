import { loop } from '../classes/frames.ts';
import { task } from '../reactivity/tasks.ts';
import { linear, type Easing } from './easing.ts';

export interface AnimationConfig {
	delay?: number;
	duration?: number;
	easing?: Easing;
	css?: (t: number, u: number) => string;
	tick?: (t: number, u: number) => void;
}

export type Direction = 'in' | 'out';

export type Deferred = (options: { direction: Direction }) => Options;

export type Options = AnimationConfig | Deferred | null | undefined;

export interface Running {
	abort(): void;
	deactivate(): void;
	reset(): void;
	t(): number;
}

function camel(property: string): string {
	if (property === 'float') return 'cssFloat';
	if (property === 'offset') return 'cssOffset';
	if (property.startsWith('--')) return property;
	return property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

export function keyframe(css: string): Keyframe {
	const frame: Keyframe = {};
	for (const part of css.split(';')) {
		const [property, value] = part.split(':');
		if (!property || value === undefined) break;
		frame[camel(property.trim())] = value.trim();
	}
	return frame;
}

function noop(): void {}

export function animate(
	element: Element,
	options: Options,
	counterpart: Running | undefined,
	target: 0 | 1,
	begin: () => void,
	finish: () => void
): Running {
	const intro = target === 1;
	if (typeof options === 'function') {
		let aborted = false;
		let running: Running | undefined;
		task(() => {
			if (aborted) return;
			const config = options({ direction: intro ? 'in' : 'out' });
			if (aborted) return;
			running = animate(element, config, counterpart, target, begin, finish);
		});
		return {
			abort() {
				aborted = true;
				running?.abort();
			},
			deactivate: () => running?.deactivate(),
			reset: () => running?.reset(),
			t: () => running?.t() ?? 1 - target
		};
	}
	counterpart?.deactivate();
	if (!options?.duration && !options?.delay) {
		begin();
		finish();
		return { abort: noop, deactivate: noop, reset: noop, t: () => target };
	}
	const { delay = 0, css, tick, easing = linear } = options;
	const duration = options.duration ?? 0;
	let aborted = false;
	let done = finish;
	let animation: Animation | undefined;
	let progress = (): number => 1 - target;
	task(() => {
		if (aborted) return;
		const frames: Keyframe[] = [];
		if (intro && counterpart === undefined) {
			tick?.(0, 1);
			if (css) {
				const first = keyframe(css(0, 1));
				frames.push(first, first);
			}
		}
		const placeholder = element.animate(frames, { duration: delay, fill: 'forwards' });
		animation = placeholder;
		placeholder.onfinish = () => {
			placeholder.cancel();
			begin();
			const from = counterpart?.t() ?? 1 - target;
			counterpart?.abort();
			const delta = target - from;
			const span = duration * Math.abs(delta);
			const steps: Keyframe[] = [];
			let ended = false;
			if (span > 0) {
				let hidden = false;
				if (css) {
					const count = Math.ceil(span / (1000 / 60));
					for (let index = 0; index <= count; index += 1) {
						const t = from + delta * easing(index / count);
						const frame = keyframe(css(t, 1 - t));
						steps.push(frame);
						hidden ||= frame.overflow === 'hidden';
					}
				}
				if (hidden) (element as HTMLElement).style.overflow = 'hidden';
				progress = () =>
					from + delta * easing(((animation as Animation).currentTime as number) / span);
				if (tick) {
					loop(() => {
						if (ended || (animation as Animation).playState !== 'running') return false;
						const t = progress();
						tick(t, 1 - t);
						return true;
					});
				}
			}
			const main = element.animate(steps, { duration: span, fill: 'forwards' });
			animation = main;
			main.onfinish = () => {
				ended = true;
				progress = () => target;
				tick?.(target, 1 - target);
				done();
			};
		};
	});
	return {
		abort() {
			aborted = true;
			if (animation === undefined) return;
			animation.cancel();
			animation.effect = null;
			animation.onfinish = noop;
		},
		deactivate() {
			done = noop;
		},
		reset() {
			if (target === 0) tick?.(1, 0);
		},
		t: () => progress()
	};
}
