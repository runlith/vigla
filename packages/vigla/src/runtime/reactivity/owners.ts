import { keyed, type Context, type Layer } from '../../shared/context.ts';
import { failure } from '../../shared/diagnostics.ts';
import { format } from '../../shared/format.ts';
import { request, revive } from './batch.ts';
import { destroy, destroyed, detached, hide, show, start } from './effects.ts';
import { setFront } from './front.ts';
import { lifetime } from './abort.ts';
import { settledUnder, unit } from './units.ts';
import { presently } from './past.ts';
import { SCOPE, isDestroyed, isInert, type Effect } from './graph.ts';
import { ambient, carry, port } from './carried.ts';
import { handle } from './handlers.ts';
import { setOwner, withoutReaction } from './tracking.ts';

const effects = new WeakMap<Owner, Effect>();
const owners = new WeakMap<Effect, Owner>();
const pausing = new WeakSet<Effect>();

export interface Components {
	layer(): Layer<Effect> | null;
	teardown?(fn: () => void): boolean;
}

const installed: Components[] = [];

export function installComponents(components: Components): void {
	installed.push(components);
}

export function layerOf(effect: Effect | null): Layer<Effect> | null {
	return (effect?.context as Layer<Effect> | null | undefined) ?? null;
}

function standing(): Layer<Effect> | null {
	for (const components of installed) {
		const layer = components.layer();
		if (layer !== null) return layer;
	}
	return null;
}

function current(): Layer<Effect> | null {
	return standing() ?? layerOf(ambient());
}

function readable(): Layer<Effect> | null {
	const layer = current();
	if (layer === null && ambient() === null) {
		throw failure('context_without_owner', 'Context can only be read where an owner exists');
	}
	return layer;
}

function writable(): Layer<Effect> {
	const layer = standing();
	if (layer !== null) return layer;
	const effect = ambient();
	if (effect === null) {
		throw failure('context_without_owner', 'Context can only be set where an owner exists');
	}
	return ownContext(effect);
}

export function getContext<T>(key: unknown): T {
	for (let layer = readable(); layer !== null; layer = layer.parent) {
		if (layer.map?.has(key)) return layer.map.get(key) as T;
	}
	return undefined as T;
}

export function setContext<T>(key: unknown, value: T): T {
	const layer = writable();
	(layer.map ??= new Map()).set(key, value);
	return value;
}

export function hasContext(key: unknown): boolean {
	for (let layer = current(); layer !== null; layer = layer.parent) {
		if (layer.map?.has(key)) return true;
	}
	return false;
}

export function createContext<T>(): Context<T> {
	return keyed<T>({ getContext, setContext, hasContext });
}

export function getAllContexts<T extends Map<unknown, unknown> = Map<unknown, unknown>>(): T {
	const chain: Layer<Effect>[] = [];
	for (let layer = readable(); layer !== null; layer = layer.parent) chain.push(layer);
	const all = new Map<unknown, unknown>();
	for (let index = chain.length - 1; index >= 0; index--) {
		for (const [key, value] of chain[index]?.map ?? []) all.set(key, value);
	}
	return all as T;
}

function register(effect: Effect | null, fn: () => void): Effect {
	const previous = setOwner(effect);
	try {
		return destroyed(fn);
	} finally {
		setOwner(previous);
	}
}

export function onDestroy(fn: () => void): void {
	const effect = ambient();
	if (effect !== null && isDestroyed(effect)) {
		withoutReaction(() => presently(fn));
		return;
	}
	for (const components of installed) if (components.teardown?.(fn) === true) return;
	register(effect, fn);
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

export class Owner {
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
		return isDestroyed(effectOf(this));
	}

	get signal(): AbortSignal {
		return lifetime(effectOf(this));
	}

	onError(handler: (error: unknown) => void): () => void {
		const effect = effectOf(this);
		if (isDestroyed(effect)) throw new Error('Cannot handle failures under a disposed owner');
		return handle(effect, handler);
	}

	run<T>(fn: () => T): T {
		const effect = effectOf(this);
		if (isDestroyed(effect)) throw new Error('Cannot run code under a disposed owner');
		return port === null ? enter(effect, fn) : carry(effect, () => enter(effect, fn));
	}

	async start<T>(fn: () => T): Promise<Awaited<T>> {
		const effect = effectOf(this);
		if (isDestroyed(effect)) throw new Error('Cannot run code under a disposed owner');
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
		if (isDestroyed(effect)) {
			withoutReaction(() => presently(fn));
			return () => {};
		}
		let live = true;
		const registered = register(effect, () => {
			if (live) fn();
		});
		return () => {
			live = false;
			destroy(registered);
		};
	}

	get paused(): boolean {
		const effect = effectOf(this);
		return isInert(effect) || pausing.has(effect);
	}

	pause(): void {
		const effect = effectOf(this);
		if (isDestroyed(effect) || isInert(effect) || pausing.has(effect)) return;
		pausing.add(effect);
		queueMicrotask(() => {
			if (!pausing.delete(effect)) return;
			hide(effect);
			request();
		});
	}

	resume(): void {
		const effect = effectOf(this);
		if (pausing.delete(effect) || !isInert(effect)) return;
		show(effect);
		revive(effect);
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
	const effect = ambient();
	return effect === null ? null : ownerOf(effect);
}

export function root(fn?: () => void | (() => void), parent: Owner | null = null): Owner {
	if (parent !== null && parent.disposed)
		throw new Error('Cannot create a root under a disposed owner');
	const effect = detached(null, parent === null ? null : effectOf(parent));
	effect.flags |= SCOPE;
	if (parent === null) setFront(effect, format);
	const owner = ownerOf(effect);
	if (fn !== undefined) {
		effect.fn = fn;
		start(effect);
	}
	return owner;
}
