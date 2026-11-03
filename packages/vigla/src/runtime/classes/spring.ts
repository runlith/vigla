import { template } from '../reactivity/effects.ts';
import type { Source } from '../reactivity/graph.ts';
import { set, state } from '../reactivity/sources.ts';
import { get } from '../reactivity/reads.ts';
import { loop, type Task } from './frames.ts';

export interface SpringOptions {
	stiffness?: number;
	damping?: number;
	precision?: number;
}

export interface SpringUpdateOptions {
	instant?: boolean;
	preserveMomentum?: number;
}

interface Step {
	readonly mass: number;
	readonly dt: number;
	readonly stiffness: number;
	readonly damping: number;
	readonly precision: number;
	settled: boolean;
}

function isDate(value: unknown): value is Date {
	return Object.prototype.toString.call(value) === '[object Date]';
}

function clamp(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function advance(step: Step, last: unknown, current: unknown, target: unknown): unknown {
	if (typeof current === 'number' || isDate(current)) {
		const now = +current;
		const delta = +(target as number) - now;
		const velocity = (now - +(last as number)) / (step.dt || 1 / 60);
		const acceleration = (step.stiffness * delta - step.damping * velocity) * step.mass;
		const moved = (velocity + acceleration) * step.dt;
		if (Math.abs(moved) < step.precision && Math.abs(delta) < step.precision) return target;
		step.settled = false;
		return isDate(current) ? new Date(now + moved) : now + moved;
	}
	if (Array.isArray(current)) {
		return current.map((item, index) =>
			advance(step, (last as unknown[])[index], item, (target as unknown[])[index])
		);
	}
	if (typeof current === 'object' && current !== null) {
		const next: Record<string, unknown> = {};
		for (const key in current) {
			next[key] = advance(
				step,
				(last as Record<string, unknown>)[key],
				(current as Record<string, unknown>)[key],
				(target as Record<string, unknown>)[key]
			);
		}
		return next;
	}
	throw new Error(`Cannot spring ${typeof current} values`);
}

interface Pending {
	readonly promise: Promise<void>;
	resolve(): void;
	reject(error: Error): void;
}

function pending(): Pending {
	let resolve!: () => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<void>((done, fail) => {
		resolve = done;
		reject = fail;
	});
	promise.catch(() => {});
	return { promise, resolve, reject };
}

export class Spring<T> {
	readonly #stiffness = state(0.15);
	readonly #damping = state(0.8);
	readonly #precision = state(0.01);
	readonly #current: Source<T>;
	readonly #target: Source<T>;
	#last: T;
	#time = 0;
	#mass = 1;
	#momentum = 0;
	#task: Task | null = null;
	#pending: Pending | null = null;

	constructor(value: T, options: SpringOptions = {}) {
		this.#current = state(value);
		this.#target = state(value);
		this.#last = value;
		if (typeof options.stiffness === 'number') this.#stiffness.v = clamp(options.stiffness);
		if (typeof options.damping === 'number') this.#damping.v = clamp(options.damping);
		if (typeof options.precision === 'number') this.#precision.v = options.precision;
	}

	static of<U>(fn: () => U, options?: SpringOptions): Spring<U> {
		const spring = new Spring(fn(), options);
		template(() => {
			void spring.set(fn());
		});
		return spring;
	}

	#run(value: T): Promise<void> {
		set(this.#target, value);
		if (this.#task === null) {
			const recovery = 1000 / (this.#momentum * 60);
			let first = true;
			this.#task = loop((now) => {
				if (first) {
					first = false;
					this.#time = now;
				}
				this.#mass = Math.min(this.#mass + recovery, 1);
				const elapsed = Math.min(now - this.#time, 1000 / 30);
				const step: Step = {
					mass: this.#mass,
					dt: (elapsed * 60) / 1000,
					stiffness: this.#stiffness.v,
					damping: this.#damping.v,
					precision: this.#precision.v,
					settled: true
				};
				const next = advance(step, this.#last, this.#current.v, this.#target.v) as T;
				this.#last = this.#current.v;
				this.#time = now;
				set(this.#current, next);
				if (step.settled) this.#task = null;
				return !step.settled;
			});
		}
		return this.#task.promise;
	}

	set(value: T, options?: SpringUpdateOptions): Promise<void> {
		this.#pending?.reject(new Error('Aborted'));
		if (options?.instant || this.#current.v === undefined) {
			this.#task?.abort();
			this.#task = null;
			set(this.#current, set(this.#target, value));
			this.#last = value;
			return Promise.resolve();
		}
		if (options?.preserveMomentum) {
			this.#mass = 0;
			this.#momentum = options.preserveMomentum;
		}
		const settled = (this.#pending = pending());
		void this.#run(value).then(() => {
			if (settled === this.#pending) settled.resolve();
		});
		return settled.promise;
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

	get stiffness(): number {
		return get(this.#stiffness);
	}

	set stiffness(value: number) {
		set(this.#stiffness, clamp(value));
	}

	get damping(): number {
		return get(this.#damping);
	}

	set damping(value: number) {
		set(this.#damping, clamp(value));
	}

	get precision(): number {
		return get(this.#precision);
	}

	set precision(value: number) {
		set(this.#precision, value);
	}
}
