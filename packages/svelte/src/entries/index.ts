import * as core from 'vigla/internal/index-client';
import { guard, project, type Scope } from './context.ts';
import { failure, keyed, phase, provide } from './internal/client.ts';
import { format } from '../shared/format.ts';

export * from 'vigla/internal/index-client';
export { getReactionSignal as getAbortSignal } from './internal/client.ts';

const scope: Scope = { phase, failure, provide, keyed };

export const { getContext, setContext, hasContext, getAllContexts, createContext } = project(
	core,
	scope
);

export function mount<P extends core.Props, E extends core.Exports>(
	component: core.Component<P, E>,
	options: core.MountOptions<P>
): E {
	return core.mount(component, { ...options, format: options.format ?? format });
}

export function hydrate<P extends core.Props, E extends core.Exports>(
	component: core.Component<P, E>,
	options: core.HydrateOptions<P>
): E {
	return core.hydrate(component, { ...options, format: options.format ?? format });
}

export const createRawSnippet: typeof core.createRawSnippet = (factory) =>
	core.createRawSnippet(factory, format);

export function onMount(fn: () => unknown): void {
	guard(scope, 'onMount');
	core.onMount(fn);
}

export function onDestroy(fn: () => unknown): void {
	guard(scope, 'onDestroy');
	core.onDestroy(fn);
}
