export interface Contexts {
	getContext<T>(key: unknown): T;
	setContext<T>(key: unknown, value: T): T;
	hasContext(key: unknown): boolean;
	getAllContexts<T extends Map<unknown, unknown>>(): T;
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

export function project(core: Contexts, scope: Scope): Contexts {
	return {
		getContext(key) {
			guard(scope, 'getContext');
			return core.getContext(key);
		},
		setContext(key, value) {
			guard(scope, 'setContext');
			if (scope.phase() !== 'initializing') {
				throw scope.failure(
					'set_context_after_init',
					'`setContext` must be called when a component first initializes, not in a subsequent effect or after an `await` expression'
				);
			}
			return core.setContext(key, value);
		},
		hasContext(key) {
			guard(scope, 'hasContext');
			return core.hasContext(key);
		},
		getAllContexts<T extends Map<unknown, unknown>>() {
			guard(scope, 'getAllContexts');
			return core.getAllContexts<T>();
		}
	};
}
