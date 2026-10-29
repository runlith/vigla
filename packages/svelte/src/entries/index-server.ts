import * as core from 'dromon/internal/index-server';
import { guard, project, type Scope } from './context.ts';
import { failure, phase } from './internal/server.ts';

export * from 'dromon/internal/index-server';

const scope: Scope = { phase, failure };

export const { getContext, setContext, hasContext, getAllContexts } = project(core, scope);

export function onDestroy(fn: () => void): void {
	guard(scope, 'onDestroy');
	core.onDestroy(fn);
}
