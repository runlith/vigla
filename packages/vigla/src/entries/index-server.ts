import { failure } from '../shared/diagnostics.ts';

export {
	createContext,
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

export function onMount(): void {}

export function flushSync<T = void>(fn?: () => T): T {
	return fn?.() as T;
}

export function untrack<T>(fn: () => T): T {
	return fn();
}

export function mount(): never {
	return unavailable('mount');
}

export function hydrate(): never {
	return unavailable('hydrate');
}

export function unmount(): never {
	return unavailable('unmount');
}

export function fork(): never {
	return unavailable('fork');
}

export { Owner, getOwner, root } from '../runtime/reactivity/owners.ts';
export type { Cell } from '../runtime/reactivity/sources.ts';

export function effect(): void {}

export function cell<T>(value: T): { current: T } {
	return { current: value };
}

export async function tick(): Promise<void> {}

export async function settled(): Promise<void> {}
