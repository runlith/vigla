import { failure } from '../../shared/diagnostics.ts';
import { effect, teardown } from '../reactivity/effects.ts';
import type { Effect } from '../reactivity/graph.ts';
import { owner, untrack } from '../reactivity/tracking.ts';

export interface Layer {
	readonly parent: Layer | null;
	readonly owner: Effect | null;
	readonly component: boolean;
	map: Map<unknown, unknown> | null;
}

interface Initializing {
	readonly layer: Layer;
	readonly outer: Initializing | null;
	readonly saved: unknown;
	readonly deferred: (() => void)[];
}

let initializing: Initializing | null = null;

function layerOf(effect: Effect | null): Layer | null {
	return (effect?.context as Layer | null | undefined) ?? null;
}

function current(): Layer | null {
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
	const held = owner;
	const layer: Layer = { parent: current(), owner: held, component: true, map: map ?? null };
	initializing = { layer, outer: initializing, saved: held?.context, deferred: [] };
	if (held !== null) held.context = layer;
}

export function pop<T>(exports?: T): T {
	const done = initializing as Initializing;
	for (const create of done.deferred) create();
	initializing = done.outer;
	if (done.layer.owner !== null) done.layer.owner.context = done.saved;
	return exports as T;
}

export function withContext<T>(map: Map<unknown, unknown> | undefined, fn: () => T): T {
	const saved = initializing;
	const held = owner;
	const before = held?.context;
	push(map);
	try {
		const result = fn();
		pop();
		return result;
	} finally {
		initializing = saved;
		if (held !== null) held.context = before;
	}
}

export function userEffect(fn: () => void | (() => void)): void {
	if (initializing !== null && initializing.layer.owner === owner) {
		initializing.deferred.push(() => effect(fn));
		return;
	}
	effect(fn);
}

function own(): Layer {
	if (initializing !== null && initializing.layer.owner === owner) return initializing.layer;
	if (owner === null) {
		throw failure('context_without_owner', 'Context can only be set where an owner exists');
	}
	const layer = layerOf(owner);
	if (layer !== null && layer.owner === owner) return layer;
	const created: Layer = { parent: layer, owner, component: false, map: null };
	owner.context = created;
	return created;
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

export function getAllContexts<T extends Map<unknown, unknown> = Map<unknown, unknown>>(): T {
	const chain: Layer[] = [];
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
	teardown(() => {
		untrack(fn);
	});
}
