import type * as ES from 'estree';
import {
	hasAwait,
	inspection,
	isSignal,
	type Inspection,
	spanOf,
	unsupported,
	type Binding,
	type ScriptAnalysis,
	type StateField
} from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type { Rune } from '../ir/port.ts';
import { classBody, fieldValue, privateField } from './classes.ts';
import { destructured } from './patterns.ts';

export interface Context {
	readonly analysis: ScriptAnalysis;
	readonly names: b.Names;
	readonly runtime: ES.Identifier;
	readonly plain: ReadonlySet<Binding>;
	readonly hoisted: ES.Statement[];
	readonly props: ES.Identifier | null;
	readonly fields?: ReadonlyMap<string, StateField>;
	readonly awaited?: ReadonlyMap<ES.Node, ES.Identifier>;
	readonly saved?: ReadonlySet<ES.Node>;
	readonly dev?: boolean;
	readonly aliases?: Map<Binding, ES.Expression>;
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
	return b.call(b.member(context.runtime, name), ...args);
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
		return propsMember(context, (binding.prop as NonNullable<Binding['prop']>).key);
	}
	if (binding.kind === 'index') return runtime(context, 'get', node);
	if (binding.kind === 'argument') return b.call(node);
	if (!isSignal(binding)) return undefined;
	return runtime(context, 'get', node);
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
	const value = given === null ? b.id('undefined') : next(given);
	const source = binding !== undefined && isSignal(binding);
	switch (rune) {
		case '$state': {
			const proxied = primitive(value) ? value : runtime(context, 'proxy', value);
			return source ? runtime(context, 'state', proxied) : proxied;
		}
		case '$state.raw':
			return source ? runtime(context, 'state', value) : value;
		case '$derived': {
			if (given !== null && hasAwait(given)) {
				const thunk = { ...b.arrow([], value), async: true };
				const pending = runtime(context, 'save', runtime(context, 'asyncDerived', thunk));
				return b.call({ type: 'AwaitExpression', argument: pending });
			}
			return runtime(context, 'derived', b.arrow([], value));
		}
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
		return [{ type: 'VariableDeclarator', id: pattern, init: props }];
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
			const fallback = next(prop.fallback);
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

function effectCall(
	context: Context,
	rune: Rune,
	call: ES.CallExpression
): ES.Expression | undefined {
	switch (rune) {
		case '$effect':
			return {
				...call,
				callee: b.member(context.runtime, context.props === null ? 'effect' : 'userEffect')
			};
		case '$effect.pre':
			return { ...call, callee: b.member(context.runtime, 'pre') };
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

function inspectCall(
	context: Context,
	inspected: Inspection,
	next: <T extends ES.Node>(node: T) => T
): ES.Expression {
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

function assignField(
	context: Context,
	node: ES.AssignmentExpression,
	next: <T extends ES.Node>(node: T) => T
): ES.Expression | undefined {
	const left = node.left as ES.MemberExpression;
	const declared =
		left.object.type === 'ThisExpression' && !left.computed && left.property.type === 'Identifier'
			? context.fields?.get(left.property.name)
			: undefined;
	if (declared !== undefined && declared.node === node) {
		return {
			...node,
			left: { ...left, property: declared.key },
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

export function rewrite<T extends ES.Node>(context: Context, node: T): T {
	const { references, declarations, runes } = context.analysis;
	return b.rewrite(node, (current, next) => {
		const awaited = context.awaited?.get(current);
		if (awaited !== undefined) return runtime(context, 'get', awaited);
		if (current.type === 'AwaitExpression' && context.saved?.has(current)) {
			return b.call({
				type: 'AwaitExpression',
				argument: runtime(context, 'save', next(current.argument))
			});
		}
		switch (current.type) {
			case 'Identifier': {
				const binding = references.get(current);
				if (binding === undefined) return undefined;
				return read(context, current, binding);
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
					return assignField(context, current, next);
				}
				if (current.left.type !== 'Identifier') return undefined;
				const binding = references.get(current.left);
				if (binding === undefined || context.plain.has(binding)) return undefined;
				if (binding.kind === 'prop' && accessor(binding))
					return assign(context, current, binding, next);
				if (!stateful(binding) && binding.kind !== 'derived') return undefined;
				return assign(context, current, binding, next);
			}
			case 'UpdateExpression': {
				if (current.argument.type === 'MemberExpression') {
					const target = current.argument;
					if (privateField(context, target) === undefined) return undefined;
					const source = { ...target, object: next(target.object) };
					const delta = b.literal(current.operator === '++' ? 1 : -1);
					return runtime(context, current.prefix ? 'updatePre' : 'update', source, delta);
				}
				if (current.argument.type !== 'Identifier') return undefined;
				const binding = references.get(current.argument);
				if (binding === undefined || context.plain.has(binding)) return undefined;
				if (binding.kind === 'prop' && accessor(binding)) return update(context, current, binding);
				if (!stateful(binding) && binding.kind !== 'derived') return undefined;
				return update(context, current, binding);
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
				if (rune === undefined) return undefined;
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
					declarators.push({ ...declarator, init: declare(context, rune, binding, init, next) });
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
