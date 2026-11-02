import type * as ES from 'estree';
import {
	hasAwait,
	inspection,
	patternNames,
	resuming,
	spanOf,
	unsupported,
	type Binding,
	type ScriptAnalysis,
	type StateField
} from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type { RuntimeNames } from '../ir/runtime.ts';
import type { ExternalBinding } from '../ir/port.ts';
import { external } from './external.ts';
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
	readonly settlement?: ES.Identifier;
	readonly fields?: ReadonlyMap<string, StateField>;
	readonly awaited?: ReadonlyMap<ES.Node, ES.Identifier>;
	readonly saved?: ReadonlySet<ES.Node>;
	readonly segment?: ES.Identifier;
	readonly dev?: boolean;
	readonly externalCells?: Map<ExternalBinding, ES.Identifier>;
	readonly refreshing?: ES.Node;
	readonly propsId?: ES.Identifier;
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

export function inSegment(
	context: Context,
	segment: ES.Identifier,
	body: ES.Statement[]
): ES.Statement[] {
	return [
		b.constant(segment.name, runtime(context, 'segment')),
		{
			type: 'TryStatement',
			block: { type: 'BlockStatement', body },
			handler: null,
			finalizer: {
				type: 'BlockStatement',
				body: [b.statement(runtime(context, 'unsave', { ...segment }))]
			}
		}
	];
}

export function segmented<C extends Context>(
	context: C,
	body: (inner: C) => ES.Statement[]
): ES.Statement[] {
	const segment = b.id(context.names.unique('$$segment'));
	return inSegment(context, segment, body({ ...context, segment }));
}

export function asyncThunk(
	context: Context,
	expression: ES.Expression,
	wrap: (value: ES.Expression) => ES.Expression = (value) => b.object({ value })
): ES.ArrowFunctionExpression {
	if (resuming(expression).length === 0) {
		const value = rewrite({ ...context, segment: undefined }, expression);
		return { ...b.arrow([], wrap(value)), async: true };
	}
	const saved = new Set(context.saved ?? []);
	b.walk(expression, (node) => {
		if (
			node.type === 'FunctionExpression' ||
			node.type === 'ArrowFunctionExpression' ||
			node.type === 'FunctionDeclaration'
		) {
			return false;
		}
		if (node.type === 'AwaitExpression') saved.add(node);
	});
	const body = segmented({ ...context, saved }, (inner) => [
		{ type: 'ReturnStatement', argument: wrap(rewrite(inner, expression)) }
	]);
	return { ...b.arrow([], body), async: true };
}

function suspending(
	context: Context,
	statement: ES.ForOfStatement | ES.LabeledStatement,
	loop: ES.ForOfStatement,
	next: <T extends ES.Node>(node: T) => T
): ES.BlockStatement {
	const segment = context.segment!;
	const call = (name: string): ES.Statement => b.statement(runtime(context, name, { ...segment }));
	const item = b.id(context.names.unique('$$item'));
	const left = loop.left;
	const binding: ES.Statement =
		left.type === 'VariableDeclaration'
			? next({ ...left, declarations: [{ ...left.declarations[0]!, init: { ...item } }] })
			: b.statement({
					type: 'AssignmentExpression',
					operator: '=',
					left: next(left),
					right: { ...item }
				});
	const iterable = runtime(context, 'acquire', next(loop.right), { ...segment });
	const rewritten: ES.ForOfStatement = {
		...loop,
		left: {
			type: 'VariableDeclaration',
			kind: 'const',
			declarations: [{ type: 'VariableDeclarator', id: item, init: null }]
		},
		right: runtime(context, 'leave', iterable, { ...segment }),
		body: {
			type: 'BlockStatement',
			body: [
				call('reenter'),
				{
					type: 'TryStatement',
					block: { type: 'BlockStatement', body: [binding, next(loop.body)] },
					handler: null,
					finalizer: { type: 'BlockStatement', body: [call('unsave')] }
				}
			]
		}
	};
	const placed = (at: ES.Statement): ES.Statement =>
		at.type === 'LabeledStatement' ? { ...at, body: placed(at.body) } : rewritten;
	return { type: 'BlockStatement', body: [placed(statement), call('reenter')] };
}

function labeledLoop(statement: ES.Statement): ES.ForOfStatement | null {
	let at = statement;
	while (at.type === 'LabeledStatement') at = at.body;
	return at.type === 'ForOfStatement' && at.await ? at : null;
}

export function rewrite<T extends ES.Node>(context: Context, node: T): T {
	const { references, runes } = context.analysis;
	return b.rewrite(node, (current, next) => {
		const connected = external(context, current, next);
		if (connected !== undefined) return connected;
		const awaited = context.awaited?.get(current);
		if (awaited !== undefined) return { ...awaited };
		if (current.type === 'AwaitExpression' && context.saved?.has(current)) {
			if (context.segment === undefined) throw new Error('A saved await outside a segment');
			return b.call({
				type: 'AwaitExpression',
				argument: runtime(context, 'save', next(current.argument), { ...context.segment })
			});
		}
		switch (current.type) {
			case 'ExportSpecifier':
				return { ...current, local: next(current.local), exported: current.exported };
			case 'FunctionDeclaration':
			case 'FunctionExpression':
			case 'ArrowFunctionExpression':
				return context.segment === undefined
					? undefined
					: rewrite({ ...context, segment: undefined }, current);
			case 'ForOfStatement':
			case 'LabeledStatement': {
				const loop = labeledLoop(current);
				return loop !== null && context.segment !== undefined
					? suspending(context, current, loop, next)
					: undefined;
			}
			case 'Identifier': {
				const binding = references.get(current);
				if (binding?.kind === 'slot-info') return runtime(context, 'slots', context.props!);
				if (binding?.kind === 'snippet')
					return { ...current, name: context.names.bound(binding.declaration!) };
				if (!derived(binding)) return undefined;
				const call = b.call(current);
				return binding?.declarationKind === 'var'
					? { type: 'ChainExpression', expression: { ...call, optional: true } }
					: call;
			}
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
						const target = isDerivedField(declared)
							? { ...left, property: declared.key, computed: false }
							: left;
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
				if (derived(binding) && current.type === 'UpdateExpression')
					return runtime(
						context,
						'updateDerived',
						target as ES.Identifier,
						b.literal(current.operator === '++' ? 1 : -1),
						b.literal(current.prefix)
					);
				if (binding?.kind === 'item' || binding?.kind === 'index') {
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
					case '$host':
						return b.id('undefined');
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
				if (context.segment !== undefined && (current.kind as string) === 'await using')
					throw unsupported(spanOf(current), 'An `await using` declaration in an async script');
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
							const thunk = b.call(asyncThunk(context, given));
							const boxed: ES.Expression =
								context.segment === undefined
									? { type: 'AwaitExpression', argument: thunk }
									: b.call({
											type: 'AwaitExpression',
											argument: runtime(context, 'save', thunk, { ...context.segment })
										});
							return { ...current, init: runtime(context, 'held', b.member(boxed, 'value')) };
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
							init:
								current.id.type === 'Identifier'
									? runtime(context, 'spreadProps', context.props ?? b.id('$$props'))
									: (context.props ?? b.id('$$props'))
						};
					case '$props.id':
						if (context.propsId === undefined) throw unsupported(spanOf(init), `The ${rune} rune`);
						return { ...current, init: { ...context.propsId } };
					default:
						return undefined;
				}
			}
			default:
				return undefined;
		}
	});
}
