import { DEV } from 'esm-env';
import type { Layer } from '../../shared/context.ts';
import { destroyed, detached, effect } from '../reactivity/effects.ts';
import type { Effect } from '../reactivity/graph.ts';
import { installComponents, layerOf, setContext } from '../reactivity/owners.ts';
import { owner, running, setOwner, untrack } from '../reactivity/tracking.ts';

interface Initializing {
	readonly layer: Layer<Effect>;
	readonly outer: Initializing | null;
	readonly caller: Effect | null;
	readonly deferred: (() => void)[];
}

let initializing: Initializing | null = null;

function standing(): Layer<Effect> | null {
	return initializing !== null && initializing.layer.owner === owner ? initializing.layer : null;
}

function postponed(create: () => void): boolean {
	if (initializing === null || standing() === null || running() !== null) return false;
	initializing.deferred.push(create);
	return true;
}

installComponents({
	layer: standing,
	teardown: (fn) => owner !== null && postponed(() => void destroyed(fn))
});

export type Phase = 'initializing' | 'running' | null;

export function phase(): Phase {
	if (standing() !== null) return 'initializing';
	for (let layer = layerOf(owner); layer !== null; layer = layer.parent) {
		if (layer.component) return 'running';
	}
	return null;
}

export function provide<T>(key: unknown, value: T): T {
	for (let layer = standing() ?? layerOf(owner); layer !== null; layer = layer.parent) {
		if (layer.component) {
			(layer.map ??= new Map()).set(key, value);
			return value;
		}
	}
	return setContext(key, value);
}

export function push(map?: Map<unknown, unknown>): void {
	const caller = owner;
	const parent = standing() ?? layerOf(owner);
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
	if (!postponed(() => void effect(fn))) effect(fn);
}

export function onMount(fn: () => unknown): void {
	userEffect(() => {
		const cleanup = untrack(fn);
		if (typeof cleanup === 'function') return cleanup as () => void;
	});
}
