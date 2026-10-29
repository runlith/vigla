import type * as ES from 'estree';
import {
	spanOf,
	unsupported,
	type Binding,
	type ScriptAnalysis,
	type StateField
} from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import {
	classBody,
	constructorField,
	fieldValue,
	isDerivedField,
	privateDerived
} from './classes.ts';

export interface Context {
	readonly analysis: ScriptAnalysis;
	readonly names: b.Names;
	readonly runtime: ES.Identifier;
	readonly props: ES.Identifier | null;
	readonly out: ES.Identifier | null;
	readonly fields?: ReadonlyMap<string, StateField>;
}

export function runtime(
	context: Context,
	name: string,
	...args: ES.Expression[]
): ES.SimpleCallExpression {
	return b.call(b.member(context.runtime, name), ...args);
}

function single(node: ES.CallExpression): ES.Expression {
	const [first, ...rest] = node.arguments;
	if (rest.length > 0 || first?.type === 'SpreadElement') {
		throw unsupported(spanOf(node), 'A rune with more than one argument');
	}
	return first ?? b.id('undefined');
}

function derived(binding: Binding | undefined): boolean {
	return binding?.kind === 'derived';
}

function propsPattern(
	context: Context,
	pattern: ES.Pattern,
	next: <T extends ES.Node>(node: T) => T
): ES.Pattern {
	if (pattern.type !== 'ObjectPattern') return pattern;
	return {
		...pattern,
		properties: pattern.properties.map((property) => {
			if (property.type === 'RestElement' || property.value.type !== 'AssignmentPattern') {
				return property;
			}
			const assignment = property.value;
			let right = assignment.right;
			if (
				right.type === 'CallExpression' &&
				context.analysis.runes.get(right.callee) === '$bindable'
			) {
				const argument = right.arguments[0];
				if (argument === undefined) return { ...property, value: assignment.left };
				right = argument as ES.Expression;
			}
			return { ...property, value: { ...assignment, right: next(right) } };
		})
	};
}

const noop: ES.ArrowFunctionExpression = b.arrow([], []);

export function rewrite<T extends ES.Node>(context: Context, node: T): T {
	const { references, runes } = context.analysis;
	return b.rewrite(node, (current, next) => {
		switch (current.type) {
			case 'Identifier':
				return derived(references.get(current)) ? b.call(current) : undefined;
			case 'Property': {
				if (current.computed || current.kind !== 'init') return undefined;
				const value = next(current.value);
				const key = current.shorthand ? { ...current.key } : current.key;
				return value === current.value ? current : { ...current, key, shorthand: false, value };
			}
			case 'ClassBody': {
				const fields = context.analysis.classes.get(current);
				if (fields === undefined) return undefined;
				const inner: Context = { ...context, fields };
				return classBody(inner, current, fields, (child) => rewrite(inner, child));
			}
			case 'MemberExpression': {
				if (privateDerived(context, current) === undefined) return undefined;
				return b.call({ ...current, object: next(current.object) });
			}
			case 'AssignmentExpression':
			case 'UpdateExpression': {
				if (current.type === 'AssignmentExpression') {
					const declared = constructorField(context, current);
					if (declared !== undefined) {
						const left = current.left as ES.MemberExpression;
						const target = isDerivedField(declared) ? { ...left, property: declared.key } : left;
						return { ...current, left: target, right: fieldValue(context, declared, next) };
					}
					if (current.left.type === 'MemberExpression' && privateDerived(context, current.left)) {
						const left = current.left;
						if (current.operator !== '=')
							throw unsupported(spanOf(current), 'A compound assignment to a derived field');
						return b.call({ ...left, object: next(left.object) }, next(current.right));
					}
				}
				const target = current.type === 'AssignmentExpression' ? current.left : current.argument;
				const binding = target.type === 'Identifier' ? references.get(target) : undefined;
				if (derived(binding) && current.type === 'AssignmentExpression') {
					const id = target as ES.Identifier;
					const right = next(current.right);
					if (current.operator === '=') return b.call(id, right);
					if (
						current.operator === '&&=' ||
						current.operator === '||=' ||
						current.operator === '??='
					) {
						const operator = current.operator.slice(0, -1) as ES.LogicalOperator;
						return b.logical(operator, b.call(id), b.call(id, right));
					}
					const operator = current.operator.slice(0, -1) as ES.BinaryOperator;
					return b.call(id, b.binary(operator, b.call(id), right));
				}
				if (derived(binding) || binding?.kind === 'item' || binding?.kind === 'index') {
					throw unsupported(spanOf(current), `Assigning to a ${binding?.kind ?? ''} binding`);
				}
				return undefined;
			}
			case 'ExpressionStatement': {
				const expression = current.expression;
				if (expression.type !== 'CallExpression') return undefined;
				const rune = runes.get(expression.callee);
				if (rune === '$effect' || rune === '$effect.pre') return { type: 'EmptyStatement' };
				return undefined;
			}
			case 'CallExpression': {
				const rune = runes.get(current.callee);
				switch (rune) {
					case '$effect.root':
						return noop;
					case '$effect.tracking':
						return b.literal(false);
					case '$state.snapshot':
						return runtime(
							context,
							'snapshot',
							...current.arguments.map((argument) => next(argument as ES.Expression))
						);
					default:
						return undefined;
				}
			}
			case 'VariableDeclarator': {
				const init = current.init;
				if (init?.type !== 'CallExpression') return undefined;
				const rune = runes.get(init.callee);
				if (rune === undefined) return undefined;
				switch (rune) {
					case '$state':
					case '$state.raw':
						return { ...current, init: next(single(init)) };
					case '$derived':
						return {
							...current,
							init: runtime(context, 'derived', b.arrow([], next(single(init))))
						};
					case '$derived.by':
						return { ...current, init: runtime(context, 'derived', next(single(init))) };
					case '$props':
						return {
							...current,
							id: propsPattern(context, current.id, next),
							init: context.props ?? b.id('$$props')
						};
					case '$props.id':
						return { ...current, init: runtime(context, 'propsId', context.out ?? b.id('$$out')) };
					default:
						return undefined;
				}
			}
			default:
				return undefined;
		}
	});
}
