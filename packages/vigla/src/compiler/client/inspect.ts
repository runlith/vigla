import type * as ES from 'estree';
import { patternNames, type Inspection } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import { runtime, type Context } from './script.ts';

type Next = <T extends ES.Node>(node: T) => T;
type Function = ES.FunctionDeclaration | ES.FunctionExpression | ES.ArrowFunctionExpression;

export function tagged(
	context: Context,
	value: ES.Expression,
	name: string,
	signal: boolean
): ES.Expression {
	return context.dev
		? runtime(context, signal ? 'tag' : 'tagProxy', value, b.literal(name))
		: value;
}

export function traceStacks(context: Context): void {
	if (context.dev && [...context.analysis.runes.values()].includes('$inspect.trace')) {
		context.hoisted.push(b.statement(runtime(context, 'traceStacks')));
	}
}

interface Body {
	readonly declarations: ES.VariableDeclarator[];
	readonly statements: ES.Statement[];
}

function hoisted(statements: ES.Statement[]): Body {
	const names = new Map<string, ES.Identifier>();
	const initialize = (node: ES.VariableDeclaration): ES.Expression | null => {
		const assignments: ES.Expression[] = [];
		for (const declaration of node.declarations) {
			for (const name of patternNames(declaration.id))
				if (!names.has(name.name)) names.set(name.name, name);
			if (declaration.init != null)
				assignments.push({
					type: 'AssignmentExpression',
					operator: '=',
					left: declaration.id,
					right: declaration.init
				});
		}
		return assignments.length === 0
			? null
			: assignments.length === 1
				? assignments[0]!
				: { type: 'SequenceExpression', expressions: assignments };
	};
	const body = statements.map((statement) =>
		b.rewrite(statement, (node, next) => {
			if (
				node.type === 'FunctionDeclaration' ||
				node.type === 'FunctionExpression' ||
				node.type === 'ArrowFunctionExpression' ||
				node.type === 'ClassDeclaration' ||
				node.type === 'ClassExpression'
			)
				return node;
			if (
				node.type === 'ForStatement' &&
				node.init?.type === 'VariableDeclaration' &&
				node.init.kind === 'var'
			) {
				return {
					...node,
					init: initialize(node.init),
					test: node.test == null ? node.test : next(node.test),
					update: node.update == null ? node.update : next(node.update),
					body: next(node.body)
				};
			}
			if (
				(node.type === 'ForInStatement' || node.type === 'ForOfStatement') &&
				node.left.type === 'VariableDeclaration' &&
				node.left.kind === 'var'
			) {
				initialize(node.left);
				return {
					...node,
					left: node.left.declarations[0]!.id,
					right: next(node.right),
					body: next(node.body)
				};
			}
			if (node.type === 'VariableDeclaration' && node.kind === 'var') {
				const value = initialize(node);
				return value === null ? { type: 'EmptyStatement' } : b.statement(value);
			}
			return undefined;
		})
	);
	return {
		declarations: [...names.values()].map((id) => ({ type: 'VariableDeclarator', id, init: null })),
		statements: body
	};
}

export function tracedFunction(context: Context, node: Function, next: Next): Function | undefined {
	if (!context.dev || node.body.type !== 'BlockStatement') return undefined;
	const first = node.body.body[0];
	if (first?.type !== 'ExpressionStatement' || first.expression.type !== 'CallExpression')
		return undefined;
	const call = first.expression;
	if (context.analysis.runes.get(call.callee) !== '$inspect.trace') return undefined;
	const given = call.arguments[0];
	const name = node.type === 'ArrowFunctionExpression' ? 'trace' : (node.id?.name ?? 'trace');
	const position = node.loc?.start;
	const automatic = `${name} (${context.filename ?? '(unknown)'}:${position?.line ?? 0}:${position?.column ?? 0})`;
	const label = given === undefined ? b.literal(automatic) : next(given as ES.Expression);
	const body = hoisted(node.body.body.slice(1).map((statement) => next(statement)));
	const fn = { ...b.arrow([], body.statements), async: node.async };
	return {
		...node,
		params: node.params.map((param) => next(param)),
		body: {
			type: 'BlockStatement',
			body: [
				...(body.declarations.length > 0
					? [
							{
								type: 'VariableDeclaration',
								kind: 'var',
								declarations: body.declarations
							} as ES.VariableDeclaration
						]
					: []),
				{ type: 'ReturnStatement', argument: runtime(context, 'trace', b.arrow([], label), fn) }
			]
		}
	};
}

export function inspectCall(context: Context, inspected: Inspection, next: Next): ES.Expression {
	if (!context.dev)
		return { type: 'UnaryExpression', operator: 'void', prefix: true, argument: b.literal(0) };
	const values: ES.ArrayExpression = {
		type: 'ArrayExpression',
		elements: inspected.args.map((argument) => next(argument))
	};
	const rest = b.id(context.names.unique('$$args'));
	const inspector =
		inspected.inspector === null ? b.member(b.id('console'), 'log') : next(inspected.inspector);
	const forward = b.arrow(
		[{ type: 'RestElement', argument: rest }],
		b.call(inspector, { type: 'SpreadElement', argument: rest })
	);
	const args: ES.Expression[] = [b.arrow([], values), forward];
	if (inspected.inspector === null) args.push(b.literal(true));
	return runtime(context, 'inspect', ...args);
}
