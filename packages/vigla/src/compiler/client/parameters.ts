import type * as ES from 'estree';
import * as b from '../ir/estree.ts';
import { extract, type Extraction } from './patterns.ts';
import { runtime } from './script.ts';
import type { TemplateContext } from './template.ts';

export function snippetParameters(
	context: TemplateContext,
	parameters: readonly ES.Pattern[]
): { params: ES.Pattern[]; declarations: ES.Statement[] } {
	const params: ES.Pattern[] = [];
	const declarations: ES.Statement[] = [];
	parameters.forEach((parameter, index) => {
		if (parameter.type === 'Identifier') {
			params.push({
				type: 'AssignmentPattern',
				left: parameter,
				right: b.member(context.runtime, 'noop')
			});
			return;
		}
		const argument = b.id(context.names.unique(`$$arg${index}`));
		params.push(argument);
		const base: ES.Expression = {
			type: 'ChainExpression',
			expression: { type: 'CallExpression', callee: argument, arguments: [], optional: true }
		};
		const extraction: Extraction = { context, optional: true, paths: [], inserts: declarations };
		extract(extraction, parameter, base);
		for (const path of extraction.paths) {
			const thunk = b.arrow([], path.value);
			declarations.push(
				b.constant(path.name.name, path.defaulted ? runtime(context, 'derived', thunk) : thunk)
			);
		}
	});
	return { params, declarations };
}
