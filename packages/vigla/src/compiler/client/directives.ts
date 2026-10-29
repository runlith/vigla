import type * as ES from 'estree';
import * as b from '../ir/estree.ts';
import type { Action, Attachment } from '../ir/nodes.ts';
import { rewrite, runtime } from './script.ts';
import type { TemplateContext } from './template.ts';

function optionalCall(callee: ES.Expression, args: ES.Expression[]): ES.Expression {
	return { type: 'ChainExpression', expression: { ...b.call(callee, ...args), optional: true } };
}

export function actionCall(
	context: TemplateContext,
	element: ES.Expression,
	node: Action
): ES.Statement {
	const target = b.id(context.names.unique('$$node'));
	const params = [target];
	if (node.argument !== null) params.push(b.id(context.names.unique('$$action_arg')));
	const args: ES.Expression[] = [
		element,
		b.arrow(params, optionalCall(rewrite(context, node.action), params))
	];
	if (node.argument !== null) args.push(b.arrow([], rewrite(context, node.argument)));
	return b.statement(runtime(context, 'action', ...args));
}

export function attachCall(
	context: TemplateContext,
	element: ES.Expression,
	node: Attachment
): ES.Statement {
	return b.statement(
		runtime(context, 'attach', element, b.arrow([], rewrite(context, node.expression)))
	);
}
