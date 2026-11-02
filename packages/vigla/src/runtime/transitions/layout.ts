import { task } from '../reactivity/tasks.ts';
import {
	animate,
	type AnimationConfig,
	type Direction,
	type Options,
	type Running
} from './animate.ts';
import { project, sweep, type Projection } from './frame.ts';
import { capture, placementOf, type Capture, type Placement } from './placement.ts';

export interface LayoutPlan {
	match(): void;
	stabilize(): void;
	measure(): void;
	read(): AnimationConfig | undefined;
	cancel(): void;
}

export class LayoutContext {
	readonly element: Element;
	direction: Direction | null;
	readonly #plans = new Set<LayoutPlan>();
	#captured: Capture | undefined;
	#poses: readonly [Capture, Capture] | null = null;
	#references = 0;
	#declaring = true;

	constructor(element: Element, direction: Direction | null = null) {
		this.element = element;
		this.direction = direction;
	}

	get captured(): Capture {
		return (this.#captured ??= passOf().capture(this.element));
	}

	get placement(): Placement {
		return placementOf(this.element);
	}

	measured(from: Capture, to: Capture): void {
		this.#poses = [from, to];
	}

	local(from: DOMRect, to: DOMRect): Projection | null {
		const poses = this.#poses;
		if (poses === null || poses[0].rect !== from || poses[1].rect !== to) return null;
		return project(poses[0], poses[1]);
	}

	stage(plan: LayoutPlan): LayoutPass | null {
		this.#plans.add(plan);
		if (!this.#declaring) return null;
		const pass = passOf();
		this.#captured ??= pass.capture(this.element);
		pass.plans.add(plan);
		return pass;
	}

	seal(): void {
		this.#declaring = false;
	}

	cancel(): void {
		for (const plan of this.#plans) plan.cancel();
		this.#plans.clear();
	}

	retain(): () => void {
		this.#references++;
		let retained = true;
		return () => {
			if (!retained) return;
			retained = false;
			if (--this.#references === 0) this.cancel();
		};
	}
}

export let layout: LayoutContext | null = null;

export function withinLayout<T>(context: LayoutContext, fn: () => T): T {
	const previous = layout;
	layout = context;
	try {
		return fn();
	} finally {
		layout = previous;
	}
}

function scoped(context: LayoutContext, options: Options): Options {
	if (typeof options !== 'function') return options;
	return (direction) => withinLayout(context, () => scoped(context, options(direction)));
}

export class LayoutPass {
	readonly plans = new Set<LayoutPlan>();
	readonly #captures = new Map<Element, Capture>();
	#ready = false;

	get ready(): boolean {
		return this.#ready;
	}

	capture(element: Element): Capture {
		let found = this.#captures.get(element);
		if (found === undefined) this.#captures.set(element, (found = capture(element)));
		return found;
	}

	withdraw(plan: LayoutPlan): void {
		this.plans.delete(plan);
	}

	drain(): void {
		if (pending === this) pending = null;
		try {
			for (const plan of this.plans) plan.match();
			for (const plan of this.plans) plan.stabilize();
			sweep(() => {
				for (const plan of this.plans) plan.measure();
			});
			this.#ready = true;
		} catch (error) {
			for (const plan of this.plans) plan.cancel();
			throw error;
		} finally {
			this.plans.clear();
			this.#captures.clear();
		}
	}
}

let pending: LayoutPass | null = null;

function passOf(): LayoutPass {
	if (pending === null) {
		const pass = (pending = new LayoutPass());
		task(() => pass.drain());
	}
	return pending;
}

export function captureLayout(element: Element): Capture {
	return passOf().capture(element);
}

export function play(
	element: Element,
	context: LayoutContext,
	options: Options,
	counterpart: Running | undefined,
	target: 0 | 1,
	begin: () => void,
	finish: () => void
): Running {
	const release = context.retain();
	const running = animate(element, scoped(context, options), counterpart, target, begin, () => {
		try {
			finish();
		} finally {
			if (target === 1) release();
		}
	});
	return {
		abort() {
			running.abort();
			release();
		},
		deactivate: () => running.deactivate(),
		reset: () => running.reset(),
		t: () => running.t()
	};
}
