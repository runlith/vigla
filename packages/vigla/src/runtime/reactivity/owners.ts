import type { Layer } from '../../shared/context.ts';
import { format } from '../../shared/format.ts';
import { destroy, destroyed, detached, start } from './effects.ts';
import { setFront } from './front.ts';
import { lifetime } from './abort.ts';
import { settledUnder, unit } from './async.ts';
import { presently } from './past.ts';
import type { Boundary, Effect } from './graph.ts';
import { carry, port } from './carried.ts';
import { owner as running, setOwner, withoutReaction } from './tracking.ts';

const effects = new WeakMap<Owner, Effect>();
const owners = new WeakMap<Effect, Owner>();
const boundaries = new WeakMap<Effect, FailureBoundary>();

export function handlerOf(effect: Effect): Boundary | null {
	const boundary = boundaries.get(effect);
	return effect.destroyed || boundary?.handlers.length === 0 ? null : (boundary ?? null);
}

export function ownContext(effect: Effect): Layer<Effect> {
	const inherited = effect.context as Layer<Effect> | null;
	if (inherited !== null && inherited.owner === effect) return inherited;
	const layer: Layer<Effect> = { parent: inherited, owner: effect, component: false, map: null };
	effect.context = layer;
	repoint(effect, inherited, layer);
	return layer;
}

function repoint(effect: Effect, inherited: Layer<Effect> | null, layer: Layer<Effect>): void {
	for (let child = effect.first; child !== null; child = child.next) {
		const context = child.context as Layer<Effect> | null;
		if (context === inherited) {
			child.context = layer;
			repoint(child, inherited, layer);
		} else if (context?.owner === child && context.parent === inherited && !context.isolated) {
			context.parent = layer;
		}
	}
}

type ErrorHandler = (error: unknown) => void;

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
		if (handler === undefined || this.#effect.destroyed) throw error;
		const previous = setOwner(this.#effect);
		try {
			withoutReaction(() => handler(error));
		} finally {
			setOwner(previous);
		}
	}
}

export class Owner {
	#boundary: FailureBoundary | null = null;

	constructor(effect: Effect) {
		effects.set(this, effect);
		owners.set(effect, this);
		ownContext(effect);
	}

	get parent(): Owner | null {
		const parent = effectOf(this).parent;
		return parent === null ? null : ownerOf(parent);
	}

	get disposed(): boolean {
		return effectOf(this).destroyed;
	}

	get signal(): AbortSignal {
		return lifetime(effectOf(this));
	}

	onError(handler: ErrorHandler): () => void {
		const effect = effectOf(this);
		if (effect.destroyed) throw new Error('Cannot handle failures under a disposed owner');
		const boundary = (this.#boundary ??= new FailureBoundary(effect));
		boundaries.set(effect, boundary);
		const registered: ErrorHandler = (error) => handler(error);
		boundary.handlers.push(registered);
		return () => {
			const index = boundary.handlers.indexOf(registered);
			if (index !== -1) boundary.handlers.splice(index, 1);
		};
	}

	run<T>(fn: () => T): T {
		const effect = effectOf(this);
		if (effect.destroyed) throw new Error('Cannot run code under a disposed owner');
		return port === null ? enter(effect, fn) : carry(effect, () => enter(effect, fn));
	}

	async start<T>(fn: () => T): Promise<Awaited<T>> {
		const effect = effectOf(this);
		if (effect.destroyed) throw new Error('Cannot run code under a disposed owner');
		const finish = unit(effect);
		try {
			return await this.run(fn);
		} finally {
			finish();
		}
	}

	settled(): Promise<void> {
		return settledUnder(effectOf(this));
	}

	root(fn?: () => void | (() => void)): Owner {
		return root(fn, this);
	}

	onDispose(fn: () => void): () => void {
		const effect = effectOf(this);
		if (effect.destroyed) {
			withoutReaction(() => presently(fn));
			return () => {};
		}
		let live = true;
		const previous = setOwner(effect);
		let registered: Effect;
		try {
			registered = destroyed(() => {
				if (live) fn();
			});
		} finally {
			setOwner(previous);
		}
		return () => {
			live = false;
			destroy(registered);
		};
	}

	dispose(): void {
		destroy(effectOf(this));
	}
}

function enter<T>(effect: Effect, fn: () => T): T {
	const previous = setOwner(effect);
	try {
		return withoutReaction(fn);
	} finally {
		setOwner(previous);
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
	const effect = detached(null, parent === null ? null : effectOf(parent));
	effect.scope = true;
	if (parent === null) setFront(effect, format);
	const owner = ownerOf(effect);
	if (fn !== undefined) {
		effect.fn = fn;
		start(effect);
	}
	return owner;
}
