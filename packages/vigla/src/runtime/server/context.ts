import type { Layer } from '../../shared/context.ts';
import { lifetime } from '../reactivity/abort.ts';
import { failure } from '../../shared/diagnostics.ts';
import { destroy, teardown } from '../reactivity/effects.ts';
import type { Effect } from '../reactivity/graph.ts';
import { ambient } from '../reactivity/carried.ts';
import { installComponents, layerOf, ownerOf } from '../reactivity/owners.ts';
import { owner, setOwner } from '../reactivity/tracking.ts';
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

function standing(): Layer<Effect> | null {
	if (render === null || owner !== render.scope) return null;
	const layer = layerOf(owner);
	return layer !== null && layer.component ? layer : null;
}

function instanceOf(effect: Effect): Instance | null {
	for (let layer = layerOf(effect); layer !== null; layer = layer.parent) {
		if (layer.component) return layer as Instance;
	}
	return null;
}

installComponents({
	layer: standing,
	teardown(fn) {
		const effect = ambient();
		const instance =
			effect !== null && render !== null && effect === render.scope ? instanceOf(effect) : null;
		if (instance === null) return false;
		(instance.destroys ??= []).push(fn);
		return true;
	}
});

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
	const effect = ambient();
	if (effect === null) {
		throw failure(
			'context_without_owner',
			'Hydration data can only be opened where an owner exists'
		);
	}
	stores.set(effect, data);
}

export function hydrationData(): Data | null {
	return storeOf(ambient());
}

export function getAbortSignal(): AbortSignal {
	const effect = ambient();
	return effect === null ? new AbortController().signal : lifetime(effect);
}

function open(captured: Render | null, layer: Layer<Effect> | null, at: Output | null): Saved {
	const previous: Saved = { render, owner, site };
	render = captured;
	site = at;
	if (captured !== null) {
		captured.scope.context = layer;
		setOwner(captured.scope);
	}
	return previous;
}

function close(previous: Saved): void {
	render = previous.render;
	site = previous.site;
	setOwner(previous.owner);
}

export type Resume = <T>(fn: () => T) => T;

export function capture(): Resume {
	const captured = render;
	const layer = layerOf(captured?.scope ?? null);
	const at = site;
	return (fn) => {
		const previous = open(captured, layer, at);
		try {
			return fn();
		} finally {
			close(previous);
		}
	};
}

interface Left {
	readonly render: Render | null;
	readonly layer: Layer<Effect> | null;
	readonly site: Output | null;
}

export interface Segment {
	replaced: Saved | null;
	left: Left | null;
}

export function segment(): Segment {
	return { replaced: null, left: null };
}

export function unsave(segment: Segment): void {
	const replaced = segment.replaced;
	if (replaced === null) return;
	segment.replaced = null;
	close(replaced);
}

export function leave<T>(value: T, segment: Segment): T {
	segment.left = { render, layer: layerOf(render?.scope ?? null), site };
	unsave(segment);
	return value;
}

export function reenter(segment: Segment): void {
	const left = segment.left;
	if (left !== null && segment.replaced === null)
		segment.replaced = open(left.render, left.layer, left.site);
}

type Step = ((...args: unknown[]) => unknown) | null | undefined;

interface Steps {
	readonly next: Step;
	readonly return?: Step;
}

interface Iterated {
	readonly [Symbol.asyncIterator]?: Step;
	readonly [Symbol.iterator]?: Step;
}

function stepped(iterator: Steps, segment: Segment): Steps {
	const step = (method: Step): Step =>
		method == null
			? undefined
			: (...args) => {
					reenter(segment);
					try {
						return method.apply(iterator, args);
					} finally {
						unsave(segment);
					}
				};
	return { next: step(iterator.next), return: step(iterator.return) };
}

export function acquire(iterable: unknown, segment: Segment): object {
	const source = iterable as Iterated;
	const method = source?.[Symbol.asyncIterator];
	if (method != null) {
		const iterator = stepped(method.call(source) as Steps, segment);
		return { [Symbol.asyncIterator]: () => iterator };
	}
	const iterator = stepped((source[Symbol.iterator] as Step)!.call(source) as Steps, segment);
	return { [Symbol.iterator]: () => iterator };
}

export async function save<T>(value: T | PromiseLike<T>, segment: Segment): Promise<() => T> {
	const captured = render;
	const layer = layerOf(captured?.scope ?? null);
	const at = site;
	unsave(segment);
	const resolved = await value;
	return () => {
		segment.replaced = open(captured, layer, at);
		if (layer !== null) resumed.add(layer);
		return resolved;
	};
}

export function isRendering(): boolean {
	return render !== null;
}

export type Phase = 'initializing' | 'running' | null;

export function phase(): Phase {
	const layer = standing();
	if (layer === null) return null;
	return resumed.has(layer) ? 'running' : 'initializing';
}
