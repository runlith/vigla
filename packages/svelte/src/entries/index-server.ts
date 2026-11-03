import * as core from 'vigla/internal/index-server';
import { guard, project, type Scope } from './context.ts';
import { failure, keyed, phase, provide } from './internal/server.ts';

export * from 'vigla/internal/index-server';

const scope: Scope = { phase, failure, provide, keyed };

export const { getContext, setContext, hasContext, getAllContexts, createContext } = project(
	core,
	scope
);

export function onDestroy(fn: () => void): void {
	guard(scope, 'onDestroy');
	core.onDestroy(fn);
}
