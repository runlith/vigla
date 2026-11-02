import { staleReaction } from '../../shared/abort.ts';
import { failure } from '../../shared/diagnostics.ts';
import { teardown } from './effects.ts';
import type { Effect, Reaction } from './graph.ts';
import { evaluation, owner } from './tracking.ts';

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

export function getAbortSignal(): AbortSignal {
	if (evaluation() === null && owner !== null) return lifetime(owner);
	return getReactionSignal();
}

export function getReactionSignal(): AbortSignal {
	const reaction = evaluation();
	if (reaction === null) {
		throw failure(
			'get_abort_signal_outside_reaction',
			'`getAbortSignal()` can only be called inside an effect or derived'
		);
	}
	let controller = controllers.get(reaction);
	if (controller === undefined) {
		controller = new AbortController();
		controllers.set(reaction, controller);
		const current = controller;
		teardown(() => {
			if (controllers.get(reaction) === current) controllers.delete(reaction);
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
