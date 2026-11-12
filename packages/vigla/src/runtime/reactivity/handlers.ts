import { isDestroyed, type Boundary, type Effect } from './graph.ts';
import { setOwner, withoutReaction } from './tracking.ts';

type ErrorHandler = (error: unknown) => void;

const boundaries = new WeakMap<Effect, FailureBoundary>();

class FailureBoundary implements Boundary {
	readonly showing = false;
	readonly handlers: ErrorHandler[] = [];
	readonly #effect: Effect;

	constructor(effect: Effect) {
		this.#effect = effect;
	}

	get parent(): Boundary | null {
		return this.#effect.parent?.boundary ?? null;
	}

	settle(delta: 1 | -1): void {
		this.parent?.settle(delta);
	}

	failed(error: unknown): void {
		const handler = this.handlers.at(-1);
		if (handler === undefined || isDestroyed(this.#effect)) throw error;
		const previous = setOwner(this.#effect);
		try {
			withoutReaction(() => handler(error));
		} finally {
			setOwner(previous);
		}
	}
}

export function handlerOf(effect: Effect): Boundary | null {
	const boundary = boundaries.get(effect);
	return isDestroyed(effect) || boundary?.handlers.length === 0 ? null : (boundary ?? null);
}

export function handle(effect: Effect, handler: ErrorHandler): () => void {
	let boundary = boundaries.get(effect);
	if (boundary === undefined) {
		boundary = new FailureBoundary(effect);
		boundaries.set(effect, boundary);
	}
	const handlers = boundary.handlers;
	const registered: ErrorHandler = (error) => handler(error);
	handlers.push(registered);
	return () => {
		const index = handlers.indexOf(registered);
		if (index !== -1) handlers.splice(index, 1);
	};
}
