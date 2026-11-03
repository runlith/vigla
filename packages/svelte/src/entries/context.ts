import type { Contexts as Keys } from 'vigla/internal/client';
import type { Context } from 'vigla/internal/index-client';

export interface Contexts extends Keys {
	getAllContexts<T extends Map<unknown, unknown>>(): T;
	createContext<T>(): Context<T>;
}

export interface Scope {
	readonly phase: () => 'initializing' | 'running' | null;
	readonly failure: (code: string, message: string) => Error;
	readonly provide: <T>(key: unknown, value: T) => T;
	readonly keyed: <T>(keys: Keys) => Context<T>;
}

function outside(scope: Scope, name: string): Error {
	return scope.failure(
		'lifecycle_outside_component',
		`\`${name}(...)\` can only be used during component initialisation`
	);
}

export function guard(scope: Scope, name: string): void {
	if (scope.phase() === null) throw outside(scope, name);
}

export function project(core: Contexts, scope: Scope): Contexts {
	const keys: Keys = {
		getContext(key) {
			guard(scope, 'getContext');
			return core.getContext(key);
		},
		setContext(key, value) {
			guard(scope, 'setContext');
			return scope.provide(key, value);
		},
		hasContext(key) {
			guard(scope, 'hasContext');
			return core.hasContext(key);
		}
	};
	return {
		...keys,
		getAllContexts<T extends Map<unknown, unknown>>() {
			guard(scope, 'getAllContexts');
			return core.getAllContexts<T>();
		},
		createContext: <T>() => scope.keyed<T>(keys)
	};
}
