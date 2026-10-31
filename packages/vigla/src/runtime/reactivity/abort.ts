import { staleReaction } from '../../shared/abort.ts';
import { failure } from '../../shared/diagnostics.ts';
import { teardown } from './effects.ts';
import type { Reaction } from './graph.ts';
import { running } from './tracking.ts';

const controllers = new WeakMap<Reaction, AbortController>();

export function getAbortSignal(): AbortSignal {
	const reaction = running();
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
			controllers.delete(reaction);
			current.abort(staleReaction);
		});
	}
	return controller.signal;
}
