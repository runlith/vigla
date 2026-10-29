import { parseProgram, type FrontEnd } from 'dromon/compiler';
import { collectRunes, Lowering } from './lower.ts';
import { parse } from './parse.ts';

export const front: FrontEnd = {
	component({ source, filename }) {
		const ast = parse(source);
		const lowering = new Lowering();
		if (ast.instance !== null) lowering.expression(ast.instance.content);
		if (ast.module !== null) lowering.expression(ast.module.content);
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
				runes: lowering.runes,
				ignores: new Map()
			},
			warnings: []
		};
	},
	module({ source, filename }) {
		const program = parseProgram(source, 0, source.length);
		const runes = new Map();
		collectRunes(program, runes);
		return {
			unit: { kind: 'module', source, filename, program, runes, ignores: new Map() },
			warnings: []
		};
	}
};
