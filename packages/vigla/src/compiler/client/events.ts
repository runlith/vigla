import type * as ES from 'estree';
import { isCapture, isDelegated } from '../../shared/html.ts';
import { spanOf } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type { Property } from '../ir/nodes.ts';
import { rewrite, runtime } from './script.ts';
import type { TemplateContext } from './template.ts';

export function isEvent(attribute: Property): boolean {
	return attribute.value.kind === 'expression' && /^on/i.test(attribute.name);
}

function sideEffects(expression: ES.Expression): boolean {
	return (
		expression.type === 'CallExpression' ||
		expression.type === 'NewExpression' ||
		expression.type === 'AssignmentExpression' ||
		expression.type === 'UpdateExpression' ||
		(expression.type === 'SequenceExpression' && expression.expressions.some(sideEffects))
	);
}

function pure(context: TemplateContext, expression: ES.Expression | ES.Super): boolean {
	if (context.analysis.runes.get(expression) === '$effect.tracking') return false;
	switch (expression.type) {
		case 'Literal':
			return true;
		case 'Identifier':
			return (
				!context.analysis.references.has(expression) && !context.analysis.externals.has(expression)
			);
		case 'MemberExpression':
			return pure(context, expression.object);
		case 'CallExpression':
			return (
				pure(context, expression.callee) &&
				expression.arguments.every((argument) =>
					pure(context, argument.type === 'SpreadElement' ? argument.argument : argument)
				)
			);
		default:
			return false;
	}
}

function cached(context: TemplateContext, expression: ES.Expression): boolean {
	let call = false;
	let dependent = false;
	let impure = false;
	b.walk(expression, (node) => {
		if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') return false;
		if (node.type === 'Identifier') {
			dependent ||= context.analysis.references.has(node) || context.analysis.externals.has(node);
		} else if (node.type === 'CallExpression') {
			call = true;
			impure ||= !pure(context, node.callee);
		} else if (node.type === 'TaggedTemplateExpression') {
			impure ||= !pure(context, node.tag);
		}
	});
	return impure || (call && dependent);
}

export function handler(
	context: TemplateContext,
	expression: ES.Expression,
	declarations: ES.Statement[]
): ES.Expression {
	let value = rewrite(context, expression);
	if (value.type === 'ArrowFunctionExpression' || value.type === 'FunctionExpression') return value;
	if (expression.type === 'Identifier') {
		const binding = context.analysis.references.get(expression);
		if (binding !== undefined && context.analysis.functions.has(binding)) return value;
	}
	if (cached(context, expression)) {
		const cell = b.id(context.names.unique('handler'));
		declarations.push(b.constant(cell.name, runtime(context, 'derived', b.arrow([], value))));
		value = runtime(context, 'get', cell);
	}
	const args = b.id(context.names.unique('args'));
	const callee: ES.MemberExpression = { ...b.member(value, 'apply'), optional: true };
	const invoke: ES.Expression = context.dev
		? runtime(
				context,
				'invoke',
				b.arrow([], value),
				{ type: 'ThisExpression' },
				args,
				b.object(context.positions.at(spanOf(expression).start)),
				b.literal(sideEffects(expression)),
				b.literal(
					expression.type === 'CallExpression' &&
						expression.arguments.length === 0 &&
						expression.callee.type === 'Identifier'
				)
			)
		: { type: 'ChainExpression', expression: b.call(callee, { type: 'ThisExpression' }, args) };
	return {
		type: 'FunctionExpression',
		id: null,
		params: [{ type: 'RestElement', argument: args }],
		body: {
			type: 'BlockStatement',
			body: [b.statement(invoke)]
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
	attribute: Property,
	declarations: ES.Statement[]
): ES.Statement {
	let type = attribute.name.slice(2).toLowerCase();
	const expression = (attribute.value as { expression: ES.Expression }).expression;
	const capture = isCapture(type);
	if (capture) type = type.slice(0, -7);
	const fn = named(context, type, handler(context, expression, declarations));
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
