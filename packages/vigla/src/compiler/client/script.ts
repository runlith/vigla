import type * as ES from 'estree';
import {
	fieldName,
	hasAwait,
	inspection,
	isSignal,
	resuming,
	spanOf,
	unsupported,
	type Binding,
	type ScriptAnalysis,
	type StateField
} from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type { ExternalBinding, Rune } from '../ir/port.ts';
import { external } from './external.ts';
import type { ExpressionProjection, RuntimeNames } from '../ir/runtime.ts';
import { classBody, fieldValue, privateField } from './classes.ts';
import { destructured } from './patterns.ts';
import { inspectCall, tagged, tracedFunction } from './inspect.ts';
import { validateMutation, type Ownership } from './ownership.ts';

export interface Context {
	readonly analysis: ScriptAnalysis;
	readonly names: b.Names;
	readonly runtime: ES.Identifier;
	readonly runtimeNames?: RuntimeNames;
	readonly project?: ExpressionProjection;
	readonly plain: ReadonlySet<Binding>;
	readonly hoisted: ES.Statement[];
	readonly props: ES.Identifier | null;
	readonly ownership?: Ownership;
	readonly fields?: ReadonlyMap<string, StateField>;
	readonly className?: string;
	readonly filename?: string;
	readonly awaited?: ReadonlyMap<ES.Node, ES.Identifier>;
	readonly saved?: ReadonlySet<ES.Node>;
	readonly dev?: boolean;
	readonly aliases?: Map<Binding, ES.Expression>;
	readonly renamed?: Map<Binding, string>;
	readonly externalCells?: Map<ExternalBinding, ES.Identifier>;
	readonly refreshing?: ES.Node;
}

function named(context: Context, node: ES.Identifier, binding: Binding): ES.Identifier {
	const name = context.renamed?.get(binding);
	return name === undefined ? node : { ...node, name };
}

const declaring = new Set<Rune>(['$state', '$state.raw', '$derived', '$derived.by', '$props.id']);

export const PROP_BINDABLE = 1;
export const PROP_LAZY = 2;
export const PROP_UPDATED = 4;

export function runtime(
	context: Context,
	name: string,
	...args: ES.Expression[]
): ES.SimpleCallExpression {
	return b.call(b.member(context.runtime, context.runtimeNames?.[name] ?? name), ...args);
}

function project(context: Context, original: ES.Expression, lowered: ES.Expression): ES.Expression {
	return context.project?.({ original, lowered, runtime: context.runtime }) ?? lowered;
}

export function primitive(node: ES.Expression): boolean {
	return (
		(node.type === 'Literal' && !('regex' in node)) ||
		(node.type === 'Identifier' && node.name === 'undefined') ||
		(node.type === 'TemplateLiteral' && node.expressions.length === 0)
	);
}

function single(node: ES.CallExpression): ES.Expression | null {
	const [first, ...rest] = node.arguments;
	if (rest.length > 0 || first?.type === 'SpreadElement') {
		throw unsupported(spanOf(node), 'A rune with more than one argument');
	}
	return first ?? null;
}

export function accessor(binding: Binding): boolean {
	const prop = binding.prop;
	if (binding.kind !== 'prop' || prop === null) return false;
	return binding.reassigned || prop.bindable || prop.fallback !== null;
}

function key(name: string): ES.Expression | string {
	return /^[A-Za-z_$][\w$]*$/.test(name) ? name : b.literal(name);
}

function propsMember(context: Context, name: string): ES.MemberExpression {
	const props = context.props ?? b.id('$$props');
	const property = key(name);
	return typeof property === 'string'
		? b.member(props, property)
		: { type: 'MemberExpression', object: props, property, computed: true, optional: false };
}

export function read(
	context: Context,
	node: ES.Identifier,
	binding: Binding
): ES.Expression | undefined {
	if (context.plain.has(binding)) return undefined;
	const alias = context.aliases?.get(binding);
	if (alias !== undefined) return structuredClone(alias);
	if (binding.kind === 'prop') {
		if (accessor(binding)) return b.call(node);
		const member = propsMember(context, (binding.prop as NonNullable<Binding['prop']>).key);
		return { ...member, property: { ...member.property, loc: node.loc } };
	}
	if (binding.kind === 'snippet')
		return { ...node, name: context.names.bound(binding.declaration!) };
	if (binding.kind === 'slot-info') return runtime(context, 'slots', context.props!);
	if (binding.kind === 'index') return runtime(context, 'get', node);
	if (binding.kind === 'argument') return b.call(node);
	if (!isSignal(binding)) return undefined;
	const value = runtime(context, 'get', node);
	return binding.declarationKind === 'var' ? b.logical('&&', node, value) : value;
}

function stateful(binding: Binding): boolean {
	return (binding.kind === 'state' || binding.kind === 'raw-state') && binding.reassigned;
}

function wrap(context: Context, binding: Binding, value: ES.Expression): ES.Expression {
	return binding.kind === 'state' && !primitive(value) ? runtime(context, 'proxy', value) : value;
}

function writeTo(
	context: Context,
	target: ES.Identifier,
	binding: Binding,
	value: ES.Expression
): ES.Expression {
	if (binding.kind === 'prop') return b.call(target, value);
	return runtime(context, 'set', target, wrap(context, binding, value));
}

function current(context: Context, target: ES.Identifier, binding: Binding): ES.Expression {
	return binding.kind === 'prop' ? b.call(target) : runtime(context, 'get', target);
}

function assign(
	context: Context,
	node: ES.AssignmentExpression,
	binding: Binding,
	next: <T extends ES.Node>(node: T) => T
): ES.Expression {
	if (binding.kind === 'item' || binding.kind === 'index') {
		throw unsupported(spanOf(node), `Assigning to a ${binding.kind} binding`);
	}
	const target = node.left as ES.Identifier;
	const right = next(node.right);
	if (node.operator === '=') return writeTo(context, target, binding, right);
	if (node.operator === '&&=' || node.operator === '||=' || node.operator === '??=') {
		const operator = node.operator.slice(0, -1) as ES.LogicalOperator;
		return b.logical(
			operator,
			current(context, target, binding),
			writeTo(context, target, binding, right)
		);
	}
	const operator = node.operator.slice(0, -1) as ES.BinaryOperator;
	return writeTo(
		context,
		target,
		binding,
		b.binary(operator, current(context, target, binding), right)
	);
}

function update(context: Context, node: ES.UpdateExpression, binding: Binding): ES.Expression {
	const target = node.argument as ES.Identifier;
	const delta = b.literal(node.operator === '++' ? 1 : -1);
	if (binding.kind === 'prop') {
		return runtime(context, node.prefix ? 'updatePropPre' : 'updateProp', target, delta);
	}
	return runtime(context, node.prefix ? 'updatePre' : 'update', target, delta);
}

export function declare(
	context: Context,
	rune: Rune,
	binding: Binding | undefined,
	init: ES.CallExpression,
	next: <T extends ES.Node>(node: T) => T
): ES.Expression {
	const given = single(init);
	if (rune === '$derived' && given !== null && hasAwait(given, context.awaited)) {
		const pending = runtime(
			context,
			'save',
			runtime(context, 'asyncDerived', asyncThunk(context, given))
		);
		return b.call({ type: 'AwaitExpression', argument: pending });
	}
	const value = given === null ? b.id('undefined') : next(given);
	const source = binding !== undefined && isSignal(binding);
	switch (rune) {
		case '$state': {
			const proxied = primitive(value) ? value : runtime(context, 'proxy', value);
			return source ? runtime(context, 'state', proxied) : proxied;
		}
		case '$state.raw':
			return source ? runtime(context, 'state', value) : value;
		case '$derived':
			return runtime(context, 'derived', b.arrow([], value));
		case '$derived.by':
			return runtime(context, 'derived', value);
		case '$props.id':
			return runtime(context, 'propsId');
		default:
			throw unsupported(spanOf(init), `The ${rune} rune`);
	}
}

function propDeclarators(
	context: Context,
	declarator: ES.VariableDeclarator,
	next: <T extends ES.Node>(node: T) => T
): ES.VariableDeclarator[] {
	const { declarations } = context.analysis;
	const props = context.props ?? b.id('$$props');
	const pattern = declarator.id;
	if (pattern.type === 'Identifier') {
		return [
			{
				type: 'VariableDeclarator',
				id: pattern,
				init: runtime(context, 'rest', props, { type: 'ArrayExpression', elements: [] })
			}
		];
	}
	const result: ES.VariableDeclarator[] = [];
	const seen: ES.Expression[] = [];
	for (const property of (pattern as ES.ObjectPattern).properties) {
		if (property.type === 'RestElement') {
			const name = property.argument as ES.Identifier;
			result.push({
				type: 'VariableDeclarator',
				id: name,
				init: runtime(context, 'rest', props, { type: 'ArrayExpression', elements: seen })
			});
			continue;
		}
		const value =
			property.value.type === 'AssignmentPattern' ? property.value.left : property.value;
		const binding = declarations.get(value as ES.Identifier);
		const prop = binding?.prop;
		if (binding === undefined || prop == null) continue;
		seen.push(b.literal(prop.key));
		if (!accessor(binding)) continue;
		let flags = 0;
		if (prop.bindable) flags |= PROP_BINDABLE;
		if (binding.reassigned || prop.bindable) flags |= PROP_UPDATED;
		const args: ES.Expression[] = [props, b.literal(prop.key), b.literal(flags)];
		if (prop.fallback !== null) {
			const initial = next(prop.fallback);
			const fallback =
				prop.bindable && !primitive(initial) ? runtime(context, 'proxy', initial) : initial;
			if (primitive(fallback)) {
				args.push(fallback);
			} else {
				args[2] = b.literal(flags | PROP_LAZY);
				args.push(b.arrow([], fallback));
			}
		}
		result.push({
			type: 'VariableDeclarator',
			id: value as ES.Identifier,
			init: runtime(context, 'prop', ...args)
		});
	}
	return result;
}

function effectCallee(context: Context, name: string, source: ES.Expression): ES.MemberExpression {
	const call = runtime(context, name);
	const callee = call.callee as ES.MemberExpression;
	return {
		...callee,
		object: {
			...context.runtime,
			loc: source.type === 'MemberExpression' ? source.object.loc : source.loc
		},
		property: {
			...callee.property,
			loc: source.type === 'MemberExpression' ? source.property.loc : source.loc
		}
	};
}

function effectCall(
	context: Context,
	rune: Rune,
	call: ES.CallExpression
): ES.Expression | undefined {
	switch (rune) {
		case '$effect':
			return {
				...call,
				callee: effectCallee(
					context,
					context.props === null ? 'effect' : 'userEffect',
					call.callee as ES.Expression
				)
			};
		case '$effect.pre':
			return { ...call, callee: effectCallee(context, 'pre', call.callee as ES.Expression) };
		case '$effect.root':
			return { ...call, callee: b.member(context.runtime, 'effectRoot') };
		case '$effect.tracking':
			return { ...call, callee: b.member(context.runtime, 'tracking') };
		case '$effect.pending':
			return { ...call, callee: b.member(context.runtime, 'pending') };
		case '$state.snapshot':
			return { ...call, callee: b.member(context.runtime, 'snapshot') };
		default:
			return undefined;
	}
}

function assignField(
	context: Context,
	node: ES.AssignmentExpression,
	next: <T extends ES.Node>(node: T) => T
): ES.Expression | undefined {
	const left = node.left as ES.MemberExpression;
	const mutable = mutateProp(context, node, next);
	if (mutable !== undefined) return mutable;
	const name = fieldName(left.property, left.computed);
	const declared =
		left.object.type === 'ThisExpression' && name !== null ? context.fields?.get(name) : undefined;
	if (declared !== undefined && declared.node === node) {
		return {
			...node,
			left: { ...left, property: declared.key, computed: false },
			right: fieldValue(context, declared, next)
		};
	}
	const field = privateField(context, left);
	if (field === undefined) return undefined;
	const source: ES.MemberExpression = { ...left, object: next(left.object) };
	const right = next(node.right);
	const wrap = (value: ES.Expression): ES.Expression =>
		field.rune === '$state' ? runtime(context, 'proxy', value) : value;
	if (node.operator === '=') return runtime(context, 'set', source, wrap(right));
	if (node.operator === '&&=' || node.operator === '||=' || node.operator === '??=') {
		const operator = node.operator.slice(0, -1) as ES.LogicalOperator;
		return b.logical(
			operator,
			runtime(context, 'get', source),
			runtime(context, 'set', source, wrap(right))
		);
	}
	const operator = node.operator.slice(0, -1) as ES.BinaryOperator;
	return runtime(
		context,
		'set',
		source,
		wrap(b.binary(operator, runtime(context, 'get', source), right))
	);
}

function mutateProp(
	context: Context,
	node: ES.AssignmentExpression | ES.UpdateExpression,
	next: <T extends ES.Node>(node: T) => T
): ES.Expression | undefined {
	const target = node.type === 'AssignmentExpression' ? node.left : node.argument;
	let base: ES.Node = target;
	while (base.type === 'MemberExpression') base = base.object;
	if (base.type !== 'Identifier' || target === base) return;
	const binding = context.analysis.references.get(base);
	if (binding?.kind !== 'prop' || !accessor(binding)) return;
	const mutation =
		node.type === 'AssignmentExpression'
			? { ...node, left: next(target) as ES.Pattern, right: next(node.right) }
			: { ...node, argument: next(target) as ES.Expression };
	return runtime(context, 'mutateProp', base, mutation);
}

export function asyncThunk(
	context: Context,
	expression: ES.Expression,
	wrap: (value: ES.Expression) => ES.Expression = (value) => value
): ES.ArrowFunctionExpression {
	const found = resuming(expression);
	if (found.length === 0)
		return { ...b.arrow([], wrap(rewrite(context, expression))), async: true };
	const saved = new Set([...(context.saved ?? []), ...found]);
	const value = wrap(rewrite({ ...context, saved }, expression));
	const guarded: ES.TryStatement = {
		type: 'TryStatement',
		block: { type: 'BlockStatement', body: [{ type: 'ReturnStatement', argument: value }] },
		handler: null,
		finalizer: { type: 'BlockStatement', body: [b.statement(runtime(context, 'unsave'))] }
	};
	return { ...b.arrow([], [guarded]), async: true };
}

export function rewrite<T extends ES.Node>(context: Context, node: T): T {
	const { references, declarations, runes } = context.analysis;
	return b.rewrite(node, (current, next) => {
		const connected = external(context, current, next);
		if (connected !== undefined) return connected;
		const awaited = context.awaited?.get(current);
		if (awaited !== undefined) return runtime(context, 'get', awaited);
		if (current.type === 'AwaitExpression' && context.saved?.has(current)) {
			return b.call({
				type: 'AwaitExpression',
				argument: runtime(context, 'save', next(current.argument))
			});
		}
		switch (current.type) {
			case 'ExportSpecifier':
				return { ...current, local: next(current.local), exported: current.exported };
			case 'FunctionDeclaration':
			case 'FunctionExpression':
			case 'ArrowFunctionExpression':
				return tracedFunction(context, current, next);
			case 'ClassDeclaration':
			case 'ClassExpression': {
				const inner = { ...context, className: current.id?.name ?? '(anonymous)' };
				return {
					...current,
					superClass: current.superClass == null ? current.superClass : next(current.superClass),
					body: rewrite(inner, current.body)
				};
			}
			case 'Identifier': {
				const binding = references.get(current);
				if (binding === undefined) return undefined;
				const node = named(context, current, binding);
				return read(context, node, binding) ?? (node === current ? undefined : node);
			}
			case 'Property': {
				if (current.computed || current.kind !== 'init') return undefined;
				const value = next(current.value);
				const key = current.shorthand ? { ...current.key } : current.key;
				if (value === current.value) return current;
				return { ...current, key, shorthand: false, value };
			}
			case 'ClassBody': {
				const fields = context.analysis.classes.get(current);
				if (fields === undefined) return undefined;
				const inner: Context = { ...context, fields };
				return classBody(inner, current, fields, (child) => rewrite(inner, child));
			}
			case 'MemberExpression': {
				const field = privateField(context, current);
				if (field === undefined) return undefined;
				return runtime(context, 'get', { ...current, object: next(current.object) });
			}
			case 'AssignmentExpression': {
				if (current.left.type === 'MemberExpression') {
					const value = assignField(context, current, next) ?? {
						...current,
						left: next(current.left),
						right: next(current.right)
					};
					return validateMutation(context, current, project(context, current, value));
				}
				if (current.left.type !== 'Identifier') return undefined;
				const binding = references.get(current.left);
				if (binding === undefined || context.plain.has(binding)) return undefined;
				if (binding.kind === 'prop' && accessor(binding))
					return assign(context, current, binding, next);
				if (!stateful(binding) && binding.kind !== 'derived') return undefined;
				return assign(
					context,
					{ ...current, left: named(context, current.left, binding) },
					binding,
					next
				);
			}
			case 'UpdateExpression': {
				if (current.argument.type === 'MemberExpression') {
					const mutated = mutateProp(context, current, next);
					if (mutated !== undefined) return validateMutation(context, current, mutated);
					const target = current.argument;
					if (privateField(context, target) === undefined)
						return validateMutation(context, current, { ...current, argument: next(target) });
					const source = { ...target, object: next(target.object) };
					const delta = b.literal(current.operator === '++' ? 1 : -1);
					return runtime(context, current.prefix ? 'updatePre' : 'update', source, delta);
				}
				if (current.argument.type !== 'Identifier') return undefined;
				const binding = references.get(current.argument);
				if (binding === undefined || context.plain.has(binding)) return undefined;
				if (binding.kind === 'prop' && accessor(binding)) return update(context, current, binding);
				if (!stateful(binding) && binding.kind !== 'derived') return undefined;
				return update(
					context,
					{ ...current, argument: named(context, current.argument, binding) },
					binding
				);
			}
			case 'ExpressionStatement': {
				const expression = current.expression;
				if (expression.type !== 'CallExpression') return undefined;
				const removed =
					runes.get(expression.callee) === '$inspect.trace' ||
					(!context.dev && inspection(runes, expression) !== null);
				return removed ? ({ type: 'EmptyStatement' } as ES.EmptyStatement) : undefined;
			}
			case 'CallExpression': {
				const inspected = inspection(runes, current);
				if (inspected !== null) return inspectCall(context, inspected, next);
				const rune = runes.get(current.callee);
				if (rune === undefined)
					return project(context, current, {
						...current,
						callee: next(current.callee),
						arguments: current.arguments.map((argument) => next(argument))
					});
				if (rune === '$host') return runtime(context, 'host', context.props ?? b.id('undefined'));
				if (rune === '$state.eager')
					return runtime(context, 'latest', b.arrow([], next(single(current) as ES.Expression)));
				const replaced = effectCall(context, rune, current);
				if (replaced === undefined) return undefined;
				return { ...replaced, arguments: current.arguments.map((argument) => next(argument)) };
			}
			case 'VariableDeclaration': {
				let changed = false;
				const declarators: ES.VariableDeclarator[] = [];
				for (const declarator of current.declarations) {
					const init = declarator.init;
					const rune = init?.type === 'CallExpression' ? runes.get(init.callee) : undefined;
					if (rune === '$props') {
						changed = true;
						declarators.push(...propDeclarators(context, declarator, next));
						continue;
					}
					if (rune === undefined || init?.type !== 'CallExpression' || !declaring.has(rune)) {
						const rewritten = next(declarator);
						if (rewritten !== declarator) changed = true;
						declarators.push(rewritten);
						continue;
					}
					changed = true;
					if (declarator.id.type !== 'Identifier') {
						declarators.push(...destructured(context, rune, declarator.id, init, next));
						continue;
					}
					const binding = declarations.get(declarator.id);
					const value = declare(context, rune, binding, init, next);
					declarators.push({
						...declarator,
						init:
							rune === '$props.id'
								? value
								: tagged(
										context,
										value,
										declarator.id.name,
										binding !== undefined && isSignal(binding)
									)
					});
				}
				if (!changed) return current;
				if (declarators.length === 0) return { type: 'EmptyStatement' } as ES.EmptyStatement;
				return { ...current, declarations: declarators };
			}
			default:
				return undefined;
		}
	});
}
