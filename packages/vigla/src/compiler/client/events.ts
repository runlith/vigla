import type * as ES from 'estree';
import { isCapture, isDelegated } from '../../shared/html.ts';
import * as b from '../ir/estree.ts';
import type { Property } from '../ir/nodes.ts';
import { rewrite, runtime } from './script.ts';
import type { TemplateContext } from './template.ts';

export function isEvent(attribute: Property): boolean {
	return attribute.value.kind === 'expression' && /^on/i.test(attribute.name);
}

export function handler(context: TemplateContext, expression: ES.Expression): ES.Expression {
	const value = rewrite(context, expression);
	if (value.type === 'ArrowFunctionExpression' || value.type === 'FunctionExpression') return value;
	if (expression.type === 'Identifier') {
		const binding = context.analysis.references.get(expression);
		if (binding !== undefined && context.analysis.functions.has(binding)) return value;
	}
	const args = b.id(context.names.unique('args'));
	const callee: ES.MemberExpression = { ...b.member(value, 'apply'), optional: true };
	return {
		type: 'FunctionExpression',
		id: null,
		params: [{ type: 'RestElement', argument: args }],
		body: {
			type: 'BlockStatement',
			body: [
				b.statement({
					type: 'ChainExpression',
					expression: b.call(callee, { type: 'ThisExpression' }, args)
				})
			]
		},
		async: false,
		generator: false
	};
}

export function named(context: TemplateContext, type: string, fn: ES.Expression): ES.Expression {
	if (!context.dev || fn.type !== 'ArrowFunctionExpression') return fn;
	const body: ES.BlockStatement =
		fn.body.type === 'BlockStatement'
			? fn.body
			: { type: 'BlockStatement', body: [{ type: 'ReturnStatement', argument: fn.body }] };
	return {
		type: 'FunctionExpression',
		id: b.id(context.names.unique(type.replace(/[^\w$]/g, '_'))),
		params: fn.params,
		body,
		async: fn.async,
		generator: false
	};
}

export function event(
	context: TemplateContext,
	element: ES.Identifier,
	attribute: Property
): ES.Statement {
	let type = attribute.name.slice(2).toLowerCase();
	const expression = (attribute.value as { expression: ES.Expression }).expression;
	const capture = isCapture(type);
	if (capture) type = type.slice(0, -7);
	const fn = named(context, type, handler(context, expression));
	if (!capture && isDelegated(type)) {
		context.events.add(type);
		return b.statement(
			runtime(context, 'delegated', element, b.literal(type), fn, b.literal(true))
		);
	}
	const args: ES.Expression[] = [element, b.literal(type), fn];
	if (capture) args.push(b.literal(true));
	return b.statement(runtime(context, 'listen', ...args));
}
