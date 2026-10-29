import type { Context } from 'vigla/internal/index-client';

export interface Contexts {
	getContext<T>(key: unknown): T;
	setContext<T>(key: unknown, value: T): T;
	hasContext(key: unknown): boolean;
	getAllContexts<T extends Map<unknown, unknown>>(): T;
	createContext<T>(): Context<T>;
}

export interface Scope {
	readonly phase: () => 'initializing' | 'running' | null;
	readonly failure: (code: string, message: string) => Error;
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

function initializing(scope: Scope): void {
	guard(scope, 'setContext');
	if (scope.phase() !== 'initializing') {
		throw scope.failure(
			'set_context_after_init',
			'`setContext` must be called when a component first initializes, not in a subsequent effect or after an `await` expression'
		);
	}
}

export function project(core: Contexts, scope: Scope): Contexts {
	return {
		getContext(key) {
			guard(scope, 'getContext');
			return core.getContext(key);
		},
		setContext(key, value) {
			initializing(scope);
			return core.setContext(key, value);
		},
		hasContext(key) {
			guard(scope, 'hasContext');
			return core.hasContext(key);
		},
		getAllContexts<T extends Map<unknown, unknown>>() {
			guard(scope, 'getAllContexts');
			return core.getAllContexts<T>();
		},
		createContext<T>(): Context<T> {
			const [get, set, has] = core.createContext<T>();
			return [
				() => {
					guard(scope, 'getContext');
					return get();
				},
				(value) => {
					initializing(scope);
					return set(value);
				},
				() => {
					guard(scope, 'hasContext');
					return has();
				}
			];
		}
	};
}
