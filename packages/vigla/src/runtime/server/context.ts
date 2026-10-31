import { staleReaction } from '../../shared/abort.ts';
import { keyed, type Context } from '../../shared/context.ts';
import { failure } from '../../shared/diagnostics.ts';
import { teardown } from '../reactivity/effects.ts';
import type { Effect } from '../reactivity/graph.ts';
import { owner, setOwner } from '../reactivity/tracking.ts';
import type { Data } from './hydration.ts';

interface Layer {
	readonly parent: Layer | null;
	readonly owner: Effect | null;
	readonly component: boolean;
	map: Map<unknown, unknown> | null;
}

interface Render {
	layer: Layer | null;
	readonly scope: Effect;
	readonly destroys: (() => void)[];
	readonly hydration: Data;
}

export interface Saved {
	readonly render: Render | null;
	readonly owner: Effect | null;
}

let render: Render | null = null;
let destroying: Render | null = null;

const stores = new WeakMap<Effect, Data>();
const signals = new WeakMap<Effect, AbortController>();

function layerOf(effect: Effect | null): Layer | null {
	return (effect?.context as Layer | null | undefined) ?? null;
}

function current(): Layer | null {
	return render !== null ? render.layer : layerOf(owner);
}

export function push(map?: Map<unknown, unknown>): void {
	if (render === null) return;
	render.layer = { parent: render.layer, owner: null, component: true, map: map ?? null };
}

export function pop(): void {
	if (render !== null) render.layer = render.layer?.parent ?? null;
}

export function begin(scope: Effect, hydration: Data): Saved {
	const saved = { render, owner };
	render = { layer: layerOf(scope), scope, destroys: [], hydration };
	setOwner(scope);
	return saved;
}

export function end(saved: Saved): void {
	const done = render;
	render = saved.render;
	setOwner(saved.owner);
	const previous = destroying;
	destroying = done;
	try {
		for (const fn of done?.destroys ?? []) fn();
	} finally {
		destroying = previous;
	}
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
	return render?.hydration ?? storeOf(owner);
}

export function getAbortSignal(): AbortSignal {
	const scope = (destroying ?? render)?.scope ?? owner;
	if (scope === null) return new AbortController().signal;
	let controller = signals.get(scope);
	if (controller !== undefined) return controller.signal;
	controller = new AbortController();
	signals.set(scope, controller);
	const held = controller;
	if (scope.destroyed) {
		held.abort(staleReaction);
	} else {
		const previous = setOwner(scope);
		try {
			teardown(() => held.abort(staleReaction));
		} finally {
			setOwner(previous);
		}
	}
	return held.signal;
}

export function capture(): () => void {
	const captured = render;
	const layer = captured?.layer ?? null;
	return () => {
		render = captured;
		if (captured === null) return;
		captured.layer = layer;
		setOwner(captured.scope);
		queueMicrotask(() => {
			if (render !== captured) return;
			render = null;
			if (owner === captured.scope) setOwner(null);
		});
	};
}

export async function save<T>(value: T | PromiseLike<T>): Promise<() => T> {
	const restore = capture();
	const resolved = await value;
	return () => {
		restore();
		return resolved;
	};
}

export type Phase = 'initializing' | null;

export function phase(): Phase {
	return render?.layer != null ? 'initializing' : null;
}

function own(): Layer {
	const layer = current();
	if (render !== null && layer !== null && layer.component) return layer;
	if (owner === null) {
		throw failure('context_without_owner', 'Context can only be set where an owner exists');
	}
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

export function createContext<T>(): Context<T> {
	return keyed<T>({ getContext, setContext, hasContext });
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

export function onDestroy(fn: () => void): void {
	render?.destroys.push(fn);
}
