import { failure, warn } from '../../shared/diagnostics.ts';
import { OPEN_ELSE } from '../../shared/markers.ts';
import { reveal } from '../reactivity/async.ts';
import { current, onCommit, skip as skipEffect } from '../reactivity/batch.ts';
import { block, branch, destroy, fail } from '../reactivity/effects.ts';
import type { Boundary as Contract, Effect } from '../reactivity/graph.ts';
import { task } from '../reactivity/tasks.ts';
import { owner, setOwner } from '../reactivity/tracking.ts';
import { claim, cursor, hydrating, instruction, isClose, MISMATCH, skip } from './hydration.ts';
import { build, discard, place, type Built } from './range.ts';
import type { Render } from './template.ts';

type Reset = () => void;

type Snippet = (anchor: ChildNode, ...args: (() => unknown)[]) => void;

export interface BoundaryProps {
	readonly failed?: Snippet | null;
	readonly pending?: Snippet | null;
	readonly onerror?: ((error: unknown, reset: Reset) => void) | null;
}

export const FAILED = '[?';

type Transform = (error: unknown) => unknown;

const transforms = new WeakMap<Contract, Transform>();

const rooted = new WeakMap<Effect, Transform>();

export function transformAt(root: Effect, transform: Transform | undefined): void {
	if (transform !== undefined) rooted.set(root, transform);
}

function rootTransform(): Transform | undefined {
	for (let current = owner; current !== null; current = current.parent) {
		const transform = rooted.get(current);
		if (transform !== undefined) return transform;
	}
	return undefined;
}

class Boundary implements Contract {
	readonly parent: Contract | null;
	showing = false;
	readonly #props: BoundaryProps;
	readonly #content: Render;
	readonly #effect: Effect;
	readonly #owner: Effect | null;
	readonly #transform: (error: unknown) => unknown;
	#anchor: ChildNode;
	#units = 0;
	#main: Built | null = null;
	#pending: Built | null = null;
	#failed: Built | null = null;
	#building = false;
	#errored = false;
	#falling = false;

	constructor(
		node: ChildNode,
		props: BoundaryProps,
		content: Render,
		transform?: (error: unknown) => unknown
	) {
		this.#anchor = node;
		this.#props = props;
		this.#content = content;
		this.#owner = owner;
		this.parent = owner?.boundary ?? null;
		this.#transform =
			transform ??
			(this.parent === null ? rootTransform() : transforms.get(this.parent)) ??
			((error) => error);
		transforms.set(this, this.#transform);
		this.#effect = block(() => {
			if (hydrating) this.#hydrate(node);
			else this.#render();
		});
	}

	#branch(render: Render, own: boolean): Built {
		return build(render, (fn) => (own ? branch(fn, this) : branch(fn)));
	}

	#fallback(render: Render): Built {
		this.#falling = true;
		try {
			return this.#branch(render, true);
		} finally {
			this.#falling = false;
		}
	}

	#hydrate(node: ChildNode): void {
		const data = instruction(node);
		claim(node.nextSibling);
		if (data.startsWith(FAILED)) {
			const error = JSON.parse(data.slice(FAILED.length)) as unknown;
			const failed = this.#props.failed;
			const { reset, report } = this.#resettable(error);
			task(report);
			if (failed)
				this.#failed = this.#fallback((anchor) =>
					failed(
						anchor,
						() => error,
						() => reset
					)
				);
			this.#settleAnchor();
			return;
		}
		if (data === OPEN_ELSE) {
			const pending = this.#props.pending;
			if (pending) {
				this.showing = true;
				this.#pending = this.#branch((anchor) => pending(anchor), false);
			}
			this.#settleAnchor();
			task(() => {
				if (this.#effect.destroyed) return;
				this.#offscreen();
			});
			return;
		}
		this.#main = this.#branch(this.#content, true);
		this.#settleAnchor();
	}

	#settleAnchor(): void {
		if (!isClose(cursor)) skip();
		this.#anchor = cursor;
	}

	#render(): void {
		const pending = this.#props.pending;
		this.#building = true;
		for (const built of [this.#main, this.#pending]) if (built !== null) discard(built);
		this.#main = this.#pending = null;
		this.showing = pending != null;
		this.#units = 0;
		this.#errored = false;
		let built: Built;
		try {
			built = this.#branch(this.#content, true);
		} finally {
			this.#building = false;
		}
		if (this.#errored) {
			discard(built);
			return;
		}
		this.#main = built;
		if (this.#units > 0 && pending) {
			this.#pending = this.#branch((anchor) => pending(anchor), false);
			place(this.#pending, this.#anchor);
			return;
		}
		this.showing = false;
		place(built, this.#anchor);
		reveal(this);
	}

	#offscreen(): void {
		this.#units = 0;
		this.#building = true;
		let built: Built;
		try {
			built = this.#run(() => this.#branch(this.#content, true));
		} finally {
			this.#building = false;
		}
		this.#main = built;
		if (this.#units === 0) this.#swap();
	}

	#run<T>(fn: () => T): T {
		const previous = setOwner(this.#effect);
		try {
			return fn();
		} finally {
			setOwner(previous);
		}
	}

	#swap(): void {
		this.showing = false;
		if (this.#pending !== null) {
			discard(this.#pending);
			this.#pending = null;
		}
		if (this.#main !== null) place(this.#main, this.#anchor);
		reveal(this);
	}

	settle(delta: 1 | -1): void {
		this.#units += delta;
		if (!this.#props.pending) {
			this.parent?.settle(delta);
			return;
		}
		if (delta === -1 && this.#units === 0 && this.showing && !this.#building) {
			if (this.#pending === null && this.#main !== null && this.#main.fragment === null) {
				this.showing = false;
				reveal(this);
				return;
			}
			this.#swap();
		}
	}

	#resettable(error: unknown): { reset: Reset; report: () => void } {
		let done = false;
		let reporting = false;
		const reset: Reset = () => {
			if (this.#effect.destroyed) return;
			if (done) {
				warn(
					'boundary_reset_noop',
					'A boundary `reset` function only resets the boundary the first time it is called'
				);
				return;
			}
			done = true;
			if (reporting) {
				throw failure(
					'boundary_reset_onerror',
					'A boundary `reset` function cannot be called while an error is still being handled'
				);
			}
			if (this.#failed !== null) {
				discard(this.#failed);
				this.#failed = null;
			}
			this.#run(() => this.#render());
		};
		const report = (): void => {
			if (this.#effect.destroyed) return;
			try {
				reporting = true;
				this.#props.onerror?.(error, reset);
			} catch (thrown) {
				this.#escalate(thrown);
			} finally {
				reporting = false;
			}
		};
		return { reset, report };
	}

	#escalate(error: unknown): void {
		fail(this.#owner, error);
	}

	failed(error: unknown): void {
		if (error === MISMATCH) throw error;
		const failed = this.#props.failed;
		if (this.#falling || this.#effect?.destroyed === true || (!failed && !this.#props.onerror)) {
			this.#escalate(error);
			return;
		}
		const batch = current();
		if (batch.fork) {
			for (const built of [this.#main, this.#pending, this.#failed]) {
				if (built !== null) skipEffect(built.effect, batch);
			}
			onCommit(batch, {
				apply: () => {
					if (!this.#effect.destroyed) this.#handle(error);
				}
			});
			return;
		}
		this.#handle(error);
	}

	#handle(error: unknown): void {
		const failed = this.#props.failed;
		this.#errored = true;
		const retiring = [this.#main, this.#pending, this.#failed];
		this.#main = this.#pending = this.#failed = null;
		this.showing = false;
		for (const built of retiring) if (built !== null) discard(built);
		task(() => {
			if (this.#effect.destroyed) return;
			let transformed: unknown;
			try {
				transformed = this.#transform(error);
			} catch (thrown) {
				this.#escalate(thrown);
				return;
			}
			const handle = (value: unknown): void => {
				if (this.#effect.destroyed) return;
				const { reset, report } = this.#resettable(value);
				report();
				if (!failed || this.#effect.destroyed) return;
				try {
					const built = this.#run(() =>
						this.#fallback((anchor) =>
							failed(
								anchor,
								() => value,
								() => reset
							)
						)
					);
					if (this.#effect.destroyed) {
						discard(built);
						return;
					}
					this.#failed = built;
					place(built, this.#anchor);
				} catch (thrown) {
					this.#escalate(thrown);
				}
			};
			if (
				transformed !== null &&
				typeof (transformed as PromiseLike<unknown>)?.then === 'function'
			) {
				(transformed as PromiseLike<unknown>).then(handle, (thrown: unknown) =>
					this.#escalate(thrown)
				);
			} else {
				handle(transformed);
			}
		});
	}
}

export function boundary(
	node: ChildNode,
	props: BoundaryProps,
	content: Render,
	transform?: (error: unknown) => unknown
): void {
	new Boundary(node, props, content, transform);
}
