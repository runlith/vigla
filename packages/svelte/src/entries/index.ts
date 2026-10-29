import * as core from 'vigla/internal/index-client';
import { guard, project, type Scope } from './context.ts';
import { failure, phase } from './internal/client.ts';

export * from 'vigla/internal/index-client';

const scope: Scope = { phase, failure };

export const { getContext, setContext, hasContext, getAllContexts } = project(core, scope);

export function onMount(fn: () => unknown): void {
	guard(scope, 'onMount');
	core.onMount(fn);
}

export function onDestroy(fn: () => unknown): void {
	guard(scope, 'onDestroy');
	core.onDestroy(fn);
}
