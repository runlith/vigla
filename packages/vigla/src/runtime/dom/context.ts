import { DEV } from 'esm-env';
import { keyed, type Context, type Layer } from '../../shared/context.ts';
import { failure } from '../../shared/diagnostics.ts';
import { destroyed, detached, effect } from '../reactivity/effects.ts';
import type { Effect } from '../reactivity/graph.ts';
import { ownContext } from '../reactivity/owners.ts';
import { owner, running, setOwner, untrack } from '../reactivity/tracking.ts';

interface Initializing {
	readonly layer: Layer<Effect>;
	readonly outer: Initializing | null;
	readonly caller: Effect | null;
	readonly deferred: (() => void)[];
}

let initializing: Initializing | null = null;

function layerOf(effect: Effect | null): Layer<Effect> | null {
	return (effect?.context as Layer<Effect> | null | undefined) ?? null;
}

function current(): Layer<Effect> | null {
	return initializing !== null && initializing.layer.owner === owner
		? initializing.layer
		: layerOf(owner);
}

export type Phase = 'initializing' | 'running' | null;

export function phase(): Phase {
	if (initializing !== null && initializing.layer.owner === owner) return 'initializing';
	for (let layer = layerOf(owner); layer !== null; layer = layer.parent) {
		if (layer.component) return 'running';
	}
	return null;
}

export function push(map?: Map<unknown, unknown>): void {
	const caller = owner;
	const parent = current();
	const instance = caller === null ? null : detached(null, caller);
	const layer: Layer<Effect> = { parent, owner: instance, component: true, map: map ?? null };
	initializing = { layer, outer: initializing, caller, deferred: [] };
	if (instance === null) return;
	instance.context = layer;
	setOwner(instance);
}

export function pop<T>(exports?: T): T {
	const done = initializing as Initializing;
	for (const create of done.deferred) create();
	initializing = done.outer;
	if (done.layer.owner !== null) setOwner(done.caller);
	return (exports ?? {}) as T;
}

export function withContext<T>(map: Map<unknown, unknown> | undefined, fn: () => T): T {
	const saved = initializing;
	const caller = owner;
	push(map);
	try {
		const result = fn();
		pop();
		return result;
	} finally {
		initializing = saved;
		setOwner(caller);
	}
}

export function userEffect(fn: () => void | (() => void)): void {
	if (DEV) Object.defineProperty(fn, 'name', { value: '$effect' });
	if (initializing !== null && initializing.layer.owner === owner && running() === null) {
		initializing.deferred.push(() => effect(fn));
		return;
	}
	effect(fn);
}

function own(): Layer<Effect> {
	if (initializing !== null && initializing.layer.owner === owner) return initializing.layer;
	if (owner === null) {
		throw failure('context_without_owner', 'Context can only be set where an owner exists');
	}
	return ownContext(owner);
}

export function getContext<T>(key: unknown): T {
	for (let layer = current(); layer !== null; layer = layer.parent) {
		if (layer.map?.has(key)) return layer.map.get(key) as T;
	}
	return undefined as T;
}

export function setContext<T>(key: unknown, value: T): T {
	const layer = own();
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
	for (let layer = current(); layer !== null; layer = layer.parent) chain.push(layer);
	const all = new Map<unknown, unknown>();
	for (let index = chain.length - 1; index >= 0; index--) {
		for (const [key, value] of chain[index]?.map ?? []) all.set(key, value);
	}
	return all as T;
}

export function onMount(fn: () => unknown): void {
	userEffect(() => {
		const cleanup = untrack(fn);
		if (typeof cleanup === 'function') return cleanup as () => void;
	});
}

export function onDestroy(fn: () => unknown): void {
	destroyed(() => {
		untrack(fn);
	});
}
