import { flushSync } from 'svelte';

type Frame = Record<string, string>;

function interpolate(from: string, to: string, progress: number): string {
	if (from === to) return from;
	const fallback = progress < 0.5 ? from : to;
	const a = from.match(/[\d.]+|[^\d.]+/g);
	const b = to.match(/[\d.]+|[^\d.]+/g);
	if (a === null || b === null || a.length !== b.length) return fallback;
	let result = '';
	for (let i = 0; i < a.length; i += 2) {
		const start = parseFloat(a[i] ?? '');
		const end = parseFloat(b[i] ?? '');
		result += start + (end - start) * progress;
		if (a[i + 1] !== b[i + 1]) return fallback;
		result += a[i + 1] ?? '';
	}
	return result;
}

class FakeAnimation {
	readonly target: HTMLElement;
	currentTime: number | null = 0;
	startTime: number | null = 0;
	playState = 'running';
	readonly #clock: Clock;
	readonly #keyframes: Frame[];
	readonly #duration: number;
	readonly #delay: number;
	readonly #offset: number;
	#finish: () => void = () => {};
	#cancel: () => void = () => {};

	constructor(
		clock: Clock,
		target: HTMLElement,
		keyframes: unknown,
		options: number | KeyframeAnimationOptions | undefined
	) {
		this.#clock = clock;
		this.#offset = clock.time;
		this.target = target;
		this.#keyframes = Array.isArray(keyframes) ? (keyframes as Frame[]) : [];
		if (typeof options === 'number') {
			this.#duration = options;
			this.#delay = 0;
		} else {
			const { duration = 0, delay = 0 } = options ?? {};
			this.#duration = typeof duration === 'object' ? 0 : Math.round(+duration);
			this.#delay = delay;
		}
		this.update();
	}

	update(): void {
		const elapsed = this.#clock.time - this.#offset - this.#delay;
		this.currentTime = elapsed;
		if (elapsed < 0) return;
		this.#apply(elapsed / this.#duration);
		if (elapsed >= this.#duration) {
			this.#finish();
			this.#clock.animations.delete(this);
		}
	}

	#apply(progress: number): void {
		const position = Math.min(1, Math.max(0, progress)) * (this.#keyframes.length - 1);
		const lower = this.#keyframes[Math.floor(position)];
		const upper = this.#keyframes[Math.ceil(position)];
		let frame = lower;
		if (lower !== upper && lower !== undefined) {
			frame = {};
			for (const key in lower)
				frame[key] = interpolate(
					lower[key] as string,
					(upper as Frame)[key] as string,
					position % 1
				);
		}
		const style = this.target.style as unknown as Record<string, string | null>;
		for (const property in frame) style[property] = frame[property] ?? null;
		if (this.currentTime !== null && this.currentTime >= this.#duration) {
			this.currentTime = this.#duration;
			for (const property in frame) style[property] = null;
		}
	}

	cancel(): void {
		if (this.currentTime !== null && this.currentTime > 0 && this.currentTime < this.#duration)
			this.#apply(0);
		this.currentTime = null;
		this.startTime = null;
		this.playState = 'idle';
		this.#cancel();
		this.#clock.animations.delete(this);
	}

	set onfinish(callback: () => void) {
		if (this.#duration === 0) {
			callback();
			return;
		}
		this.#finish = () => {
			callback();
			this.#finish = () => {};
		};
	}

	set oncancel(callback: () => void) {
		this.#cancel = () => {
			callback();
			this.#cancel = () => {};
		};
	}
}

export class Clock {
	time = 0;
	readonly animations = new Set<FakeAnimation>();
	readonly #frames = new Map<number, FrameRequestCallback>();
	#next = 0;

	install(): void {
		globalThis.requestAnimationFrame = (callback) => {
			this.#next += 1;
			this.#frames.set(this.#next, callback);
			return this.#next;
		};
		globalThis.cancelAnimationFrame = (handle) => {
			this.#frames.delete(handle);
		};
		Object.defineProperty(globalThis.performance, 'now', {
			configurable: true,
			writable: true,
			value: () => this.time
		});
		const clock = this;
		Object.defineProperty(HTMLElement.prototype, 'animate', {
			configurable: true,
			writable: true,
			value(this: HTMLElement, keyframes: unknown, options?: number | KeyframeAnimationOptions) {
				const animation = new FakeAnimation(clock, this, keyframes, options);
				clock.animations.add(animation);
				return animation;
			}
		});
		Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
			configurable: true,
			writable: true,
			value(this: HTMLElement) {
				return [...clock.animations].filter((animation) => animation.target === this);
			}
		});
	}

	reset(): void {
		this.time = 0;
		this.animations.clear();
		this.#frames.clear();
	}

	tick(time: number): void {
		this.time = time;
		flushSync();
		for (const animation of this.animations) animation.update();
		const frames = [...this.#frames.values()];
		this.#frames.clear();
		for (const frame of frames) frame(this.time);
	}
}

export const clock = new Clock();

export const raf = {
	tick: (time: number): void => clock.tick(time)
};
