import { destroy, detached } from './effects.ts';
import type { Effect } from './graph.ts';
import { owner as running, setOwner, withoutReaction } from './tracking.ts';

const effects = new WeakMap<Owner, Effect>();
const owners = new WeakMap<Effect, Owner>();

export class Owner {
	constructor(effect: Effect) {
		effects.set(this, effect);
		owners.set(effect, this);
	}

	get parent(): Owner | null {
		const parent = effectOf(this).parent;
		return parent === null ? null : ownerOf(parent);
	}

	get disposed(): boolean {
		return effectOf(this).destroyed;
	}

	run<T>(fn: () => T): T {
		const effect = effectOf(this);
		if (effect.destroyed) throw new Error('Cannot run code under a disposed owner');
		const previous = setOwner(effect);
		try {
			return withoutReaction(fn);
		} finally {
			setOwner(previous);
		}
	}

	dispose(): void {
		destroy(effectOf(this));
	}
}

export function effectOf(owner: Owner): Effect {
	return effects.get(owner) as Effect;
}

export function ownerOf(effect: Effect): Owner {
	return owners.get(effect) ?? new Owner(effect);
}

export function getOwner(): Owner | null {
	return running === null ? null : ownerOf(running);
}

export function root(fn?: () => void | (() => void), parent: Owner | null = null): Owner {
	if (parent !== null && parent.disposed)
		throw new Error('Cannot create a root under a disposed owner');
	return ownerOf(detached(fn ?? null, parent === null ? null : effectOf(parent)));
}
