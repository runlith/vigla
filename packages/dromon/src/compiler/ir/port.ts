import type * as ES from 'estree';
import type { Fragment, Options, Span } from './nodes.ts';

export type Rune =
	| '$state'
	| '$state.raw'
	| '$state.snapshot'
	| '$state.eager'
	| '$derived'
	| '$derived.by'
	| '$effect'
	| '$effect.pre'
	| '$effect.root'
	| '$effect.tracking'
	| '$effect.pending'
	| '$props'
	| '$props.id'
	| '$bindable'
	| '$inspect'
	| '$inspect.trace'
	| '$host';

export type Runes = ReadonlyMap<ES.Node, Rune>;

export type Ignores = ReadonlyMap<object, ReadonlySet<string>>;

export interface Diagnostic extends Span {
	readonly code: string;
	readonly message: string;
}

export class CompileError extends Error {
	readonly diagnostic: Diagnostic;

	constructor(diagnostic: Diagnostic) {
		super(diagnostic.message);
		this.name = 'CompileError';
		this.diagnostic = diagnostic;
	}
}

export interface ComponentUnit {
	readonly kind: 'component';
	readonly source: string;
	readonly filename: string | null;
	readonly module: ES.Program | null;
	readonly instance: ES.Program | null;
	readonly template: Fragment;
	readonly options: Options | null;
	readonly runes: Runes;
	readonly ignores: Ignores;
}

export interface ModuleUnit {
	readonly kind: 'module';
	readonly source: string;
	readonly filename: string | null;
	readonly program: ES.Program;
	readonly runes: Runes;
	readonly ignores: Ignores;
}

export type Unit = ComponentUnit | ModuleUnit;

export interface Reading<U extends Unit> {
	readonly unit: U;
	readonly warnings: readonly Diagnostic[];
}

export interface Input {
	readonly source: string;
	readonly filename: string | null;
}

export interface FrontEnd {
	component(input: Input): Reading<ComponentUnit>;
	module(input: Input): Reading<ModuleUnit>;
}
