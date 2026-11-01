import {
	parseProgram,
	type ComponentUnit,
	type Diagnostic,
	type FrontEnd,
	type Reading
} from 'vigla/compiler';
import { Lowering } from './lower.ts';
import { parseComponent, type Parsed } from './parse/index.ts';
import { Resolution } from './runes.ts';
import { stores } from './stores.ts';

export type * as AST from './ast.ts';
export { legacy } from './legacy.ts';
export { locator, type Locator } from './locate.ts';
export { parseComponent, parseStylesheet, type Parsed } from './parse/index.ts';
export { print, type PrintOptions, type Printed } from './print/index.ts';
export {
	validateComponent,
	validateModuleSyntax,
	type ValidateOptions,
	type Validated
} from './validate/index.ts';
export type { Anchor, Anchors } from './validate/anchors.ts';

export interface Lowered extends Reading<ComponentUnit> {
	readonly anchored: ReadonlyMap<object, readonly Diagnostic[]>;
	readonly lowered: ReadonlyMap<object, object>;
}

export function lowerComponent(parsed: Parsed, source: string, filename: string | null): Lowered {
	const ast = parsed.root;
	const lowering = new Lowering(parsed.ts);
	const module = ast.module === undefined ? null : lowering.program(ast.module.content);
	const moduleReferences = new Set(lowering.resolution.references.keys());
	const instance = ast.instance === undefined ? null : lowering.program(ast.instance.content);
	const template = lowering.fragment(ast.fragment);
	const comment = ast.css?.content.comment;
	if (ast.css && comment) lowering.templateIgnores(ast.css, [comment]);
	return {
		unit: {
			kind: 'component',
			source,
			filename,
			module,
			instance,
			template,
			externals: stores(lowering.resolution, module, instance),
			slotReferences: new Set(
				[...lowering.resolution.references]
					.filter(([reference, name]) => name === '$$slots' && !moduleReferences.has(reference))
					.map(([reference]) => reference)
			),
			style: ast.css ?? null,
			options: lowering.options(ast.options),
			runes: lowering.resolution.runes,
			ignores: lowering.ignores
		},
		warnings: [],
		anchored: lowering.anchored,
		lowered: lowering.lowered
	};
}

export const front: FrontEnd = {
	component({ source, filename }) {
		return lowerComponent(parseComponent(source), source, filename);
	},
	module({ source, filename }) {
		const program = parseProgram(source, 0, source.length);
		const resolution = new Resolution();
		resolution.program(program);
		return {
			unit: {
				kind: 'module',
				source,
				filename,
				program,
				runes: resolution.runes,
				ignores: new Map()
			},
			warnings: []
		};
	}
};
