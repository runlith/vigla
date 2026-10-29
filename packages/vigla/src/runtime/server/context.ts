import { failure } from '../../shared/diagnostics.ts';

interface Layer {
	readonly parent: Layer | null;
	map: Map<unknown, unknown> | null;
}

interface Render {
	layer: Layer | null;
	readonly destroys: (() => void)[];
}

let render: Render | null = null;

export function push(map?: Map<unknown, unknown>): void {
	if (render === null) return;
	render.layer = { parent: render.layer, map: map ?? null };
}

export function pop(): void {
	if (render !== null) render.layer = render.layer?.parent ?? null;
}

export function begin(): Render | null {
	const saved = render;
	render = { layer: null, destroys: [] };
	return saved;
}

export function end(saved: Render | null): void {
	const done = render;
	render = saved;
	for (const fn of done?.destroys ?? []) fn();
}

export function capture(): () => void {
	const captured = render;
	const layer = captured?.layer ?? null;
	return () => {
		render = captured;
		if (captured !== null) captured.layer = layer;
		queueMicrotask(() => {
			if (render === captured) render = null;
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

export function getContext<T>(key: unknown): T {
	for (let layer = render?.layer ?? null; layer !== null; layer = layer.parent) {
		if (layer.map?.has(key)) return layer.map.get(key) as T;
	}
	return undefined as T;
}

export function setContext<T>(key: unknown, value: T): T {
	const layer = render?.layer;
	if (layer == null) {
		throw failure('context_without_owner', 'Context can only be set where an owner exists');
	}
	(layer.map ??= new Map()).set(key, value);
	return value;
}

export function hasContext(key: unknown): boolean {
	for (let layer = render?.layer ?? null; layer !== null; layer = layer.parent) {
		if (layer.map?.has(key)) return true;
	}
	return false;
}

export function getAllContexts<T extends Map<unknown, unknown> = Map<unknown, unknown>>(): T {
	const chain: Layer[] = [];
	for (let layer = render?.layer ?? null; layer !== null; layer = layer.parent) chain.push(layer);
	const all = new Map<unknown, unknown>();
	for (let index = chain.length - 1; index >= 0; index--) {
		for (const [key, value] of chain[index]?.map ?? []) all.set(key, value);
	}
	return all as T;
}

export function onDestroy(fn: () => void): void {
	render?.destroys.push(fn);
}
