export interface Fresh {
	before(): void;
	after(): void;
}

export interface Target {
	name: string;
	root: string;
	fresh: string;
}

declare module 'vitest' {
	export interface ProvidedContext {
		target: Target;
	}
}
