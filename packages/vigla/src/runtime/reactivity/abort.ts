import { staleReaction } from '../../shared/abort.ts';
import { failure } from '../../shared/diagnostics.ts';
import { teardown } from './effects.ts';
import type { Reaction } from './graph.ts';
import { evaluation } from './tracking.ts';

const controllers = new WeakMap<object, AbortController>();

export function getAbortSignal(): AbortSignal {
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
