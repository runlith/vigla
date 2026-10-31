import { failure } from '../shared/diagnostics.ts';
import type * as client from './index.ts';
import type { Cell } from '../runtime/reactivity/sources.ts';

export {
	createContext,
	getAbortSignal,
	getAllContexts,
	getContext,
	hasContext,
	onDestroy,
	setContext
} from '../runtime/server/context.ts';
export type { Context } from '../shared/context.ts';
export { external } from '../runtime/server/external.ts';
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

export function untrack<T>(fn: () => T): T {
	return fn();
}

export const mount: typeof client.mount = () => unavailable('mount');
export const hydrate: typeof client.hydrate = () => unavailable('hydrate');
export const unmount: typeof client.unmount = () => unavailable('unmount');
export const fork: typeof client.fork = () => unavailable('fork');

export { Owner, getOwner, root } from '../runtime/reactivity/owners.ts';
export type { Cell } from '../runtime/reactivity/sources.ts';

export function effect(..._args: Parameters<typeof client.effect>): void {}

export function cell<T>(value: T): Cell<T> {
	return { current: value };
}

export async function tick(): Promise<void> {}

export async function settled(): Promise<void> {}
