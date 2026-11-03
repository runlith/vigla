import { staleReaction } from '../../shared/abort.ts';
import type { Effect, Reaction } from './graph.ts';

const controllers = new WeakMap<object, AbortController>();
const lifetimes = new WeakMap<Effect, AbortController>();

export function lifetime(effect: Effect): AbortSignal {
	let controller = lifetimes.get(effect);
	if (controller === undefined) {
		controller = new AbortController();
		lifetimes.set(effect, controller);
		if (effect.destroyed) controller.abort(staleReaction);
	}
	return controller.signal;
}

export function abortLifetime(effect: Effect): void {
	lifetimes.get(effect)?.abort(staleReaction);
}

export function evaluationSignal(
	evaluation: object,
	release: (stop: () => void) => unknown
): AbortSignal {
	let controller = controllers.get(evaluation);
	if (controller === undefined) {
		controller = new AbortController();
		controllers.set(evaluation, controller);
		const current = controller;
		release(() => {
			if (controllers.get(evaluation) === current) controllers.delete(evaluation);
			current.abort(staleReaction);
		});
	}
	return controller.signal;
}

export function abort(reaction: Reaction): boolean {
	const controller = controllers.get(reaction);
	if (controller === undefined) return false;
	controllers.delete(reaction);
	controller.abort(staleReaction);
	return true;
}
