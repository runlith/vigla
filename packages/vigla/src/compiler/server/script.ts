import type * as ES from 'estree';
import {
	hasAwait,
	inspection,
	patternNames,
	spanOf,
	unsupported,
	type Binding,
	type ScriptAnalysis,
	type StateField
} from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type { RuntimeNames } from '../ir/runtime.ts';
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
	readonly runtimeNames?: RuntimeNames;
	readonly props: ES.Identifier | null;
	readonly out: ES.Identifier | null;
	readonly fields?: ReadonlyMap<string, StateField>;
	readonly awaited?: ReadonlyMap<ES.Node, ES.Identifier>;
	readonly saved?: ReadonlySet<ES.Node>;
	readonly dev?: boolean;
}

export function runtime(
	context: Context,
	name: string,
	...args: ES.Expression[]
): ES.SimpleCallExpression {
	return b.call(b.member(context.runtime, context.runtimeNames?.[name] ?? name), ...args);
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

function leaves(pattern: ES.Pattern, next: <T extends ES.Node>(node: T) => T): ES.Pattern {
	switch (pattern.type) {
		case 'AssignmentPattern':
			return { ...pattern, left: leaves(pattern.left, next), right: next(pattern.right) };
		case 'ObjectPattern':
			return {
				...pattern,
				properties: pattern.properties.map((property) =>
					property.type === 'RestElement'
						? { ...property, argument: leaves(property.argument, next) }
						: {
								...property,
								key: property.computed ? next(property.key) : property.key,
								value: leaves(property.value, next),
								shorthand: false
							}
				)
			};
		case 'ArrayPattern':
			return {
				...pattern,
				elements: pattern.elements.map((element) =>
					element === null
						? null
						: element.type === 'RestElement'
							? { ...element, argument: leaves(element.argument, next) }
							: leaves(element, next)
				)
			};
		default:
			return pattern;
	}
}

function destructuredDerived(
	context: Context,
	declarator: ES.VariableDeclarator,
	next: <T extends ES.Node>(node: T) => T
): ES.VariableDeclarator[] {
	const holder = b.id(context.names.unique('$$d'));
	const values = b.id(context.names.unique('$$v'));
	const names = patternNames(declarator.id);
	const body: ES.Statement[] = [
		{
			type: 'VariableDeclaration',
			kind: 'const',
			declarations: [
				{ type: 'VariableDeclarator', id: leaves(declarator.id, next), init: b.call(holder) }
			]
		},
		{
			type: 'ReturnStatement',
			argument: b.object(Object.fromEntries(names.map((name) => [name.name, b.id(name.name)])))
		}
	];
	return [
		next({ type: 'VariableDeclarator', id: holder, init: declarator.init }),
		{
			type: 'VariableDeclarator',
			id: values,
			init: runtime(context, 'derived', b.arrow([], body))
		},
		...names.map((name): ES.VariableDeclarator => ({
			type: 'VariableDeclarator',
			id: name,
			init: runtime(context, 'derived', b.arrow([], b.member(b.call(values), name.name)))
		}))
	];
}

function derivedPattern(context: Context, declarator: ES.VariableDeclarator): boolean {
	const init = declarator.init;
	if (declarator.id.type === 'Identifier' || init?.type !== 'CallExpression') return false;
	const rune = context.analysis.runes.get(init.callee);
	return rune === '$derived' || rune === '$derived.by';
}

export function rewrite<T extends ES.Node>(context: Context, node: T): T {
	const { references, runes } = context.analysis;
	return b.rewrite(node, (current, next) => {
		const awaited = context.awaited?.get(current);
		if (awaited !== undefined) return { ...awaited };
		if (current.type === 'AwaitExpression' && context.saved?.has(current)) {
			return b.call({
				type: 'AwaitExpression',
				argument: runtime(context, 'save', next(current.argument))
			});
		}
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
				if (rune === '$effect' || rune === '$effect.pre' || rune === '$inspect.trace') {
					return { type: 'EmptyStatement' };
				}
				if (!context.dev && inspection(runes, expression) !== null) {
					return { type: 'EmptyStatement' };
				}
				return undefined;
			}
			case 'CallExpression': {
				const inspected = inspection(runes, current);
				if (inspected !== null) {
					if (!context.dev) return b.id('undefined');
					const args = inspected.args.map((argument) => next(argument));
					return inspected.inspector === null
						? b.call(
								b.member(b.id('console'), 'log'),
								b.literal('$inspect('),
								...args,
								b.literal(')')
							)
						: b.call(next(inspected.inspector), b.literal('init'), ...args);
				}
				const rune = runes.get(current.callee);
				switch (rune) {
					case '$effect.root':
						return noop;
					case '$effect.tracking':
						return b.literal(false);
					case '$effect.pending':
						return b.literal(0);
					case '$state.eager':
						return next(single(current));
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
			case 'VariableDeclaration': {
				if (!current.declarations.some((declarator) => derivedPattern(context, declarator)))
					return undefined;
				return {
					...current,
					declarations: current.declarations.flatMap((declarator) =>
						derivedPattern(context, declarator)
							? destructuredDerived(context, declarator, next)
							: [next(declarator)]
					)
				};
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
					case '$derived': {
						const given = single(init);
						if (hasAwait(given, context.awaited)) {
							const saved = new Set(context.saved ?? []);
							b.walk(given, (node) => {
								if (
									node.type === 'FunctionExpression' ||
									node.type === 'ArrowFunctionExpression' ||
									node.type === 'FunctionDeclaration'
								) {
									return false;
								}
								if (node.type === 'AwaitExpression') saved.add(node);
							});
							const value = rewrite({ ...context, saved }, given);
							return { ...current, init: runtime(context, 'held', value) };
						}
						return {
							...current,
							init: runtime(context, 'derived', b.arrow([], next(given)))
						};
					}
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
