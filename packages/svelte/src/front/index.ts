import { parseProgram, type FrontEnd } from 'dromon/compiler';
import { Lowering } from './lower.ts';
import { parse } from './parse.ts';
import { Resolution } from './runes.ts';

export const front: FrontEnd = {
	component({ source, filename }) {
		const ast = parse(source);
		const lowering = new Lowering();
		if (ast.module !== null) lowering.program(ast.module.content);
		if (ast.instance !== null) lowering.program(ast.instance.content);
		const template = lowering.fragment(ast.fragment);
		return {
			unit: {
				kind: 'component',
				source,
				filename,
				module: ast.module?.content ?? null,
				instance: ast.instance?.content ?? null,
				template,
				options: null,
				runes: lowering.resolution.runes,
				ignores: new Map()
			},
			warnings: []
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
