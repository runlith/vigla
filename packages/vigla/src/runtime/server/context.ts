import { keyed, type Context, type Layer } from '../../shared/context.ts';
import { lifetime } from '../reactivity/abort.ts';
import { failure } from '../../shared/diagnostics.ts';
import { destroy, destroyed, fail, teardown } from '../reactivity/effects.ts';
import type { Effect } from '../reactivity/graph.ts';
import type { Cell } from '../reactivity/sources.ts';
import { ownContext, ownerOf } from '../reactivity/owners.ts';
import { owner, setOwner, withoutReaction } from '../reactivity/tracking.ts';
import type { Data } from './hydration.ts';
import type { Output } from './render.ts';

export interface Instance extends Layer<Effect> {
	destroys: (() => void)[] | null;
}

interface Saved {
	readonly render: Render | null;
	readonly owner: Effect | null;
	readonly site: Output | null;
}

export interface Render {
	readonly scope: Effect;
	readonly out: Output;
	readonly instances: Instance[];
	readonly saved: Saved;
	released: boolean;
}

let render: Render | null = null;
let site: Output | null = null;

const stores = new WeakMap<Effect, Data>();
const resumed = new WeakSet<Layer<Effect>>();

function layerOf(effect: Effect | null): Layer<Effect> | null {
	return (effect?.context as Layer<Effect> | null | undefined) ?? null;
}

export function enter(output: Output | null): Output | null {
	const previous = site;
	site = output;
	return previous;
}

export function push(map?: Map<unknown, unknown>): void {
	if (render === null) return;
	const instance: Instance = {
		parent: layerOf(render.scope),
		owner: null,
		component: true,
		map: map ?? null,
		destroys: null
	};
	render.scope.context = instance;
	render.instances.push(instance);
	site?.place(instance);
}

export function pop(): void {
	if (render !== null) render.scope.context = layerOf(render.scope)?.parent ?? null;
}

export function begin(scope: Effect, hydration: Data, out: Output, inheritContext = true): Render {
	const saved = { render, owner, site };
	scope.context = {
		parent: inheritContext ? layerOf(scope) : null,
		owner: scope,
		component: false,
		isolated: !inheritContext,
		map: null
	};
	ownerOf(scope);
	stores.set(scope, hydration);
	const opened: Render = { scope, out, instances: [], saved, released: false };
	render = opened;
	site = out;
	setOwner(scope);
	teardown(() => release(opened));
	return opened;
}

export function end(done: Render): void {
	render = done.saved.render;
	site = done.saved.site;
	setOwner(done.saved.owner);
}

export function finish(done: Render, failed: boolean): void {
	let caught = false;
	let first: unknown;
	for (const step of [() => destroy(done.scope), () => release(done)]) {
		try {
			step();
		} catch (error) {
			if (!caught) first = error;
			caught = true;
		}
	}
	if (caught && !failed) throw first;
}

function within(instance: Instance, ancestor: Instance): boolean {
	for (let at = instance.parent; at !== null; at = at.parent) if (at === ancestor) return true;
	return false;
}

function release(done: Render): void {
	if (done.released) return;
	done.released = true;
	const ordered: Instance[] = [];
	const open: Instance[] = [];
	done.out.instances((instance) => {
		while (open.length > 0 && !within(instance, open.at(-1)!)) ordered.push(open.pop()!);
		open.push(instance);
	});
	while (open.length > 0) ordered.push(open.pop()!);
	if (ordered.length < done.instances.length) {
		const reached = new Set(ordered);
		ordered.unshift(...done.instances.filter((instance) => !reached.has(instance)).reverse());
	}
	const previous = setOwner(done.scope);
	let failed = false;
	let first: unknown;
	try {
		for (const instance of ordered) {
			for (const fn of instance.destroys ?? []) {
				try {
					fn();
				} catch (error) {
					if (!failed) first = error;
					failed = true;
				}
			}
		}
	} finally {
		setOwner(previous);
	}
	if (failed) throw first;
}

export function storeOf(effect: Effect | null): Data | null {
	for (let at = effect; at !== null; at = at.parent) {
		const data = stores.get(at);
		if (data !== undefined) return data;
	}
	return null;
}

export function openStore(data: Data): void {
	if (owner === null) {
		throw failure(
			'context_without_owner',
			'Hydration data can only be opened where an owner exists'
		);
	}
	stores.set(owner, data);
}

export function hydrationData(): Data | null {
	return storeOf(owner);
}

export function getAbortSignal(): AbortSignal {
	return owner === null ? new AbortController().signal : lifetime(owner);
}

export function memo<T>(fn: () => T, _equals?: (before: T, after: T) => boolean): Cell<T> {
	const scope = owner;
	const context = layerOf(scope);
	let computed = false;
	let overridden = false;
	let value: T;
	return {
		get current() {
			if (!overridden && (!computed || scope === null)) {
				const previous = setOwner(scope ?? owner);
				const active = scope?.context;
				if (scope !== null) scope.context = context;
				try {
					value = withoutReaction(fn);
				} catch (error) {
					if (scope === null) throw error;
					fail(scope, error);
					value = undefined as T;
				} finally {
					if (scope !== null) scope.context = active;
					setOwner(previous);
				}
				computed = true;
			}
			return value;
		},
		set current(next) {
			value = next;
			overridden = true;
		}
	};
}

export function capture(): () => void {
	const captured = render;
	const layer = layerOf(captured?.scope ?? null);
	const at = site;
	return () => {
		render = captured;
		site = at;
		if (captured === null) return;
		captured.scope.context = layer;
		setOwner(captured.scope);
		queueMicrotask(() => {
			if (render !== captured) return;
			render = null;
			site = null;
			if (owner === captured.scope) setOwner(null);
		});
	};
}

export async function save<T>(value: T | PromiseLike<T>): Promise<() => T> {
	const restore = capture();
	const layer = layerOf(render?.scope ?? null);
	const resolved = await value;
	return () => {
		restore();
		if (layer != null) resumed.add(layer);
		return resolved;
	};
}

export function isRendering(): boolean {
	return render !== null;
}

export type Phase = 'initializing' | 'running' | null;

export function phase(): Phase {
	const layer = render !== null && owner === render.scope ? layerOf(owner) : null;
	if (layer === null || !layer.component) return null;
	return resumed.has(layer) ? 'running' : 'initializing';
}

function own(): Layer<Effect> {
	const layer = layerOf(owner);
	if (render !== null && owner === render.scope && layer !== null && layer.component) return layer;
	if (owner === null) {
		throw failure('context_without_owner', 'Context can only be set where an owner exists');
	}
	return ownContext(owner);
}

export function getContext<T>(key: unknown): T {
	for (let layer = layerOf(owner); layer !== null; layer = layer.parent) {
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
	for (let layer = layerOf(owner); layer !== null; layer = layer.parent) {
		if (layer.map?.has(key)) return true;
	}
	return false;
}

export function createContext<T>(): Context<T> {
	return keyed<T>({ getContext, setContext, hasContext });
}

export function getAllContexts<T extends Map<unknown, unknown> = Map<unknown, unknown>>(): T {
	const chain: Layer<Effect>[] = [];
	for (let layer = layerOf(owner); layer !== null; layer = layer.parent) chain.push(layer);
	const all = new Map<unknown, unknown>();
	for (let index = chain.length - 1; index >= 0; index--) {
		for (const [key, value] of chain[index]?.map ?? []) all.set(key, value);
	}
	return all as T;
}

function instanceOf(effect: Effect): Instance | null {
	for (let layer = layerOf(effect); layer !== null; layer = layer.parent) {
		if (layer.component) return layer as Instance;
	}
	return null;
}

export function onDestroy(fn: () => void): void {
	if (owner?.destroyed) {
		fn();
		return;
	}
	const instance =
		owner !== null && render !== null && owner === render.scope ? instanceOf(owner) : null;
	if (instance === null) destroyed(fn);
	else (instance.destroys ??= []).push(fn);
}
