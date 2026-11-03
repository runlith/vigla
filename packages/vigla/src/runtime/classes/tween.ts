import { template } from '../reactivity/effects.ts';
import type { Source } from '../reactivity/graph.ts';
import { set, state } from '../reactivity/sources.ts';
import { get } from '../reactivity/reads.ts';
import { loop, type Task } from './frames.ts';

export type Interpolator<T> = (from: T, to: T) => (progress: number) => T;

export interface TweenOptions<T> {
	delay?: number;
	duration?: number | ((from: T, to: T) => number);
	easing?: (progress: number) => number;
	interpolate?: Interpolator<T>;
}

function linear(progress: number): number {
	return progress;
}

function isDate(value: unknown): value is Date {
	return Object.prototype.toString.call(value) === '[object Date]';
}

function between(from: unknown, to: unknown): (progress: number) => unknown {
	if (from === to || from !== from) return () => from;
	const kind = typeof from;
	if (kind !== typeof to || Array.isArray(from) !== Array.isArray(to))
		throw new Error('Cannot interpolate values of different type');
	if (Array.isArray(from)) {
		const parts = (to as unknown[]).map((item, index) => between(from[index], item));
		return (progress) => parts.map((part) => part(progress));
	}
	if (kind === 'object') {
		if (from === null || to === null) throw new Error('Object cannot be null');
		if (isDate(from) && isDate(to)) {
			const start = from.getTime();
			const delta = to.getTime() - start;
			return (progress) => new Date(start + progress * delta);
		}
		const keys = Object.keys(to as object);
		const parts = keys.map((key) =>
			between((from as Record<string, unknown>)[key], (to as Record<string, unknown>)[key])
		);
		return (progress) => {
			const result: Record<string, unknown> = {};
			for (let index = 0; index < keys.length; index++)
				result[keys[index] as string] = (parts[index] as (progress: number) => unknown)(progress);
			return result;
		};
	}
	if (kind === 'number') {
		const start = from as number;
		const delta = (to as number) - start;
		return (progress) => start + progress * delta;
	}
	return () => to;
}

export class Tween<T> {
	readonly #current: Source<T>;
	readonly #target: Source<T>;
	readonly #defaults: TweenOptions<T>;
	#task: Task | null = null;

	constructor(value: T, options: TweenOptions<T> = {}) {
		this.#current = state(value);
		this.#target = state(value);
		this.#defaults = options;
	}

	static of<U>(fn: () => U, options?: TweenOptions<U>): Tween<U> {
		const tween = new Tween(fn(), options);
		template(() => {
			tween.set(fn());
		});
		return tween;
	}

	set(value: T, options?: TweenOptions<T>): Promise<void> {
		set(this.#target, value);
		const merged = { ...this.#defaults, ...options };
		const delay = merged.delay ?? 0;
		const easing = merged.easing ?? linear;
		const interpolate = merged.interpolate ?? (between as Interpolator<T>);
		let duration = merged.duration ?? 400;
		if (duration === 0) {
			this.#task?.abort();
			set(this.#current, value);
			return Promise.resolve();
		}
		const previous = this.#task;
		let start = -1;
		let started = false;
		let fn: (progress: number) => T;
		const task = loop((now) => {
			if (start === -1) start = now + delay;
			if (now < start) return true;
			if (!started) {
				started = true;
				const from = this.#current.v;
				fn = interpolate(from, value);
				if (typeof duration === 'function') duration = duration(from, value);
				previous?.abort();
			}
			const elapsed = now - start;
			if (elapsed > (duration as number)) {
				set(this.#current, value);
				return false;
			}
			set(this.#current, fn(easing(elapsed / (duration as number))));
			return true;
		});
		this.#task = task;
		return task.promise;
	}

	get current(): T {
		return get(this.#current);
	}

	get target(): T {
		return get(this.#target);
	}

	set target(value: T) {
		void this.set(value);
	}
}
