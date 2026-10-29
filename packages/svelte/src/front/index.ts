import { parseProgram, type FrontEnd } from 'dromon/compiler';
import { Lowering } from './lower.ts';
import { parseComponent } from './parse/index.ts';
import { Resolution } from './runes.ts';

export type * as AST from './ast.ts';
export { legacy } from './legacy.ts';
export { parseComponent, parseStylesheet, type Parsed } from './parse/index.ts';
export { print, type PrintOptions, type Printed } from './print/index.ts';

export const front: FrontEnd = {
	component({ source, filename }) {
		const parsed = parseComponent(source);
		const ast = parsed.root;
		const lowering = new Lowering(parsed.ts);
		const module = ast.module === undefined ? null : lowering.program(ast.module.content);
		const instance = ast.instance === undefined ? null : lowering.program(ast.instance.content);
		const template = lowering.fragment(ast.fragment);
		return {
			unit: {
				kind: 'component',
				source,
				filename,
				module,
				instance,
				template,
				options: lowering.options(ast.options),
				runes: lowering.resolution.runes,
				ignores: new Map()
			},
			warnings: parsed.warnings
		};
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
