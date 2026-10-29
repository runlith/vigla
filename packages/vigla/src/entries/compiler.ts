import type * as ES from 'estree';
import { print } from 'esrap';
import ts from 'esrap/languages/ts';
import { analyzeComponent, analyzeModule } from '../compiler/analysis/index.ts';
import {
	validateComponent,
	validateModule,
	type ValidateOptions
} from '../compiler/analysis/validate/index.ts';
import { client, clientModule } from '../compiler/client/index.ts';
import { analyzeStyle, injected, renderStyle, type Stylesheet } from '../compiler/css/index.ts';
import type { Namespace } from '../compiler/ir/nodes.ts';
import { chain, sourceName, type InputMap, type OutputMap } from '../compiler/ir/maps.ts';
import type { ComponentUnit, Diagnostic, ModuleUnit } from '../compiler/ir/port.ts';
import { server, serverModule } from '../compiler/server/index.ts';

export type * from '../compiler/ir/nodes.ts';
export type {
	ComponentUnit,
	Diagnostic,
	FrontEnd,
	Ignores,
	Input,
	ModuleUnit,
	Reading,
	Rune,
	Runes,
	Unit
} from '../compiler/ir/port.ts';
export { CompileError } from '../compiler/ir/port.ts';
export { basename, combine, type InputMap } from '../compiler/ir/maps.ts';
export { parseExpression, parseProgram } from '../compiler/ir/script.ts';
export type * as Style from '../compiler/ir/style.ts';
export {
	analyzeStyle,
	hash,
	type Scoping,
	type StyleAnalysis,
	type StyleOptions,
	type Stylesheet
} from '../compiler/css/index.ts';
export {
	closest,
	errorMessage,
	validateComponent,
	validateModule,
	warningCodes,
	warningMessage,
	type Anchored,
	type Front,
	type ValidateOptions
} from '../compiler/analysis/validate/index.ts';

export type Generate = 'client' | 'server';

export interface Runtime {
	readonly client: string;
	readonly server: string;
}

export interface ModuleOptions {
	readonly generate: Generate;
	readonly runtime?: Runtime;
	readonly dev?: boolean;
	readonly validation?: ValidateOptions;
}

export interface Mapping {
	readonly outputFilename?: string;
	readonly inputMap?: InputMap;
}

export interface CompileOptions extends ModuleOptions, Mapping {
	readonly name: string;
	readonly preserveWhitespace?: boolean;
	readonly preserveComments?: boolean;
	readonly namespace?: Namespace;
	readonly css?: CssOptions;
	readonly hmr?: boolean;
}

export interface CssOptions {
	readonly hash: string;
	readonly inject: boolean;
	readonly outputFilename?: string;
}

export interface Code {
	readonly code: string;
	readonly map: object;
}

export interface Output {
	readonly js: Code;
	readonly css: Stylesheet | null;
	readonly warnings: readonly Diagnostic[];
}

const runtimes: Runtime = { client: 'vigla/internal/client', server: 'vigla/internal/server' };

function printed(program: ES.Program, unit: ComponentUnit | ModuleUnit, mapping: Mapping): Code {
	const { code, map } = print(program as never, ts(), {
		sourceMapSource: sourceName(unit.filename, mapping.outputFilename),
		sourceMapContent: unit.source
	});
	if (mapping.inputMap !== undefined) chain(map as OutputMap, unit.filename, mapping.inputMap);
	return { code, map: map as object };
}

export function compile(unit: ComponentUnit, options: CompileOptions): Output {
	const validated = validateComponent(unit, {
		...options.validation,
		namespace: options.namespace
	});
	const style = analyzeStyle(unit, { hash: options.css?.hash ?? '' });
	const warnings = [...validated, ...style.warnings];
	const inject = injected(style, options.css?.inject ?? false);
	const css = renderStyle(style, {
		dev: options.dev ?? false,
		inject,
		outputFilename: options.css?.outputFilename ?? null,
		inputMap: options.inputMap
	});
	const analysis = analyzeComponent(
		unit,
		{
			whitespace: options.preserveWhitespace ?? false,
			comments: options.preserveComments ?? false
		},
		options.namespace ?? 'html'
	);
	const runtime = options.runtime ?? runtimes;
	const styles = inject && css !== null ? { hash: style.scoping.hash, code: css.code } : null;
	const generation = {
		name: options.name,
		scoping: style.scoping,
		styles,
		dev: options.dev ?? false
	};
	const program =
		options.generate === 'server'
			? server(analysis, { ...generation, runtime: runtime.server })
			: client(analysis, { ...generation, runtime: runtime.client, hmr: options.hmr ?? false });
	return { js: printed(program, unit, options), css: inject ? null : css, warnings };
}

export function compileModule(unit: ModuleUnit, options: ModuleOptions): Output {
	const warnings = validateModule(unit, options.validation);
	const analysis = analyzeModule(unit);
	const runtime = options.runtime ?? runtimes;
	const program =
		options.generate === 'server'
			? serverModule(analysis, { runtime: runtime.server, dev: options.dev ?? false })
			: clientModule(analysis, { runtime: runtime.client, dev: options.dev ?? false });
	return { js: printed(program, unit, {}), css: null, warnings };
}
