import { failure } from '../shared/diagnostics.ts';
import type * as client from './index.ts';
import { unit } from '../runtime/reactivity/units.ts';
import { ambient } from '../runtime/reactivity/carried.ts';
import type { Resource } from '../runtime/reactivity/public.ts';
import { external as connect } from '../runtime/server/external.ts';
import {
	expose,
	type External,
	type Subscribable,
	type WritableExternal,
	type WritableSource
} from '../shared/external.ts';

export {
	createContext,
	getAllContexts,
	getContext,
	getOwner,
	hasContext,
	onDestroy,
	root,
	setContext
} from '../runtime/reactivity/owners.ts';
export { getAbortSignal } from '../runtime/server/context.ts';
export { cell, memo as derived, cell as state } from '../runtime/server/cells.ts';
export { untrack } from '../runtime/reactivity/tracking.ts';
export { AsyncVariable, carryAcrossAwait, type AsyncStore } from '../runtime/reactivity/carried.ts';
export type { Context } from '../shared/context.ts';
export type {
	External,
	Subscribable,
	Subscription,
	WritableExternal,
	WritableSource
} from '../shared/external.ts';
export type { Format } from '../shared/format.ts';
export { hydratable, hydrated, openHydration } from '../runtime/server/hydration.ts';
export type { HydrationOptions } from '../runtime/server/hydration.ts';
export { createRawSnippet } from '../runtime/server/snippet.ts';
export type { RawFactory, RawSnippet } from '../shared/snippet.ts';
export type {
	Component,
	Exports,
	HydrateOptions,
	MountOptions,
	Props
} from '../runtime/dom/mount.ts';

function unavailable(name: string): never {
	throw failure(
		'lifecycle_function_unavailable',
		`\`${name}(...)\` is not available on the server`
	);
}

export const onMount: typeof client.onMount = () => {};

export function flushSync<T = void>(fn?: () => T): T {
	return fn?.() as T;
}

export const mount: typeof client.mount = () => unavailable('mount');
export const hydrate: typeof client.hydrate = () => unavailable('hydrate');
export const unmount: typeof client.unmount = () => unavailable('unmount');
export const fork: typeof client.fork = () => unavailable('fork');

export type { Owner } from '../runtime/reactivity/owners.ts';
export type { Cell } from '../runtime/reactivity/sources.ts';
export type { Effects, Resource } from '../runtime/reactivity/public.ts';
export { snapshot } from '../shared/clone.ts';

const noop = (): void => {};

export const effect: typeof client.effect = Object.assign(() => noop, {
	pre: () => noop,
	root: () => noop
});

export function external<T>(read: () => WritableSource<T> | null | undefined): WritableExternal<T>;
export function external<T>(read: () => Subscribable<T> | null | undefined): External<T>;
export function external<T>(read: () => Subscribable<T> | null | undefined): WritableExternal<T> {
	return expose(connect(read));
}

export async function resource<T>(fn: () => T | PromiseLike<T>): Promise<Resource<T>> {
	const finish = unit(ambient());
	try {
		return { current: await fn() };
	} finally {
		finish();
	}
}

export function pending(): number {
	return 0;
}

export function latest<T>(fn: () => T): T {
	return fn();
}

export function tracking(): boolean {
	return false;
}

export async function tick(): Promise<void> {}

export { drained as settled } from '../runtime/reactivity/units.ts';

export async function hold<T>(fn: () => T): Promise<Awaited<T>> {
	const finish = unit(ambient());
	try {
		return await fn();
	} finally {
		finish();
	}
}
