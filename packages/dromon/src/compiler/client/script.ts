import type * as ES from 'estree';
import {
	isSignal,
	spanOf,
	unsupported,
	type Binding,
	type ScriptAnalysis
} from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type { Rune } from '../ir/port.ts';

export interface Context {
	readonly analysis: ScriptAnalysis;
	readonly names: b.Names;
	readonly runtime: ES.Identifier;
	readonly plain: ReadonlySet<Binding>;
	readonly hoisted: ES.Statement[];
}

export function runtime(
	context: Context,
	name: string,
	...args: ES.Expression[]
): ES.SimpleCallExpression {
	return b.call(b.member(context.runtime, name), ...args);
}

function primitive(node: ES.Expression): boolean {
	return node.type === 'Literal' && !('regex' in node);
}

function argument(node: ES.CallExpression): ES.Expression | null {
	const [first, ...rest] = node.arguments;
	if (rest.length > 0 || first?.type === 'SpreadElement') {
		throw unsupported(spanOf(node), 'A rune with more than one argument');
	}
	return first ?? null;
}

function declare(
	context: Context,
	rune: Rune,
	binding: Binding | undefined,
	init: ES.CallExpression,
	next: <T extends ES.Node>(node: T) => T
): ES.Expression {
	const given = argument(init);
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
		default:
			throw unsupported(spanOf(init), `The ${rune} rune`);
	}
}

function assign(
	context: Context,
	node: ES.AssignmentExpression,
	binding: Binding,
	next: <T extends ES.Node>(node: T) => T
): ES.Expression {
	if (binding.kind !== 'state' && binding.kind !== 'raw-state') {
		throw unsupported(spanOf(node), `Assigning to a ${binding.kind} binding`);
	}
	const target = node.left as ES.Identifier;
	const right = next(node.right);
	let value: ES.Expression;
	if (node.operator === '=') {
		value = right;
	} else if (node.operator === '&&=' || node.operator === '||=' || node.operator === '??=') {
		throw unsupported(spanOf(node), 'A logical assignment to state');
	} else {
		const operator = node.operator.slice(0, -1) as ES.BinaryOperator;
		value = b.binary(operator, runtime(context, 'get', target), right);
	}
	return runtime(
		context,
		'set',
		target,
		binding.kind === 'state' ? runtime(context, 'proxy', value) : value
	);
}

export function rewrite<T extends ES.Node>(context: Context, node: T): T {
	const { references, declarations, runes } = context.analysis;
	return b.rewrite(node, (current, next) => {
		switch (current.type) {
			case 'Identifier': {
				const binding = references.get(current);
				if (binding === undefined || context.plain.has(binding) || !isSignal(binding))
					return undefined;
				return runtime(context, 'get', current);
			}
			case 'Property': {
				if (current.computed || current.kind !== 'init') return undefined;
				const value = next(current.value);
				if (value === current.value) return current;
				return { ...current, shorthand: false, value };
			}
			case 'AssignmentExpression': {
				if (current.left.type !== 'Identifier') return undefined;
				const binding = references.get(current.left);
				if (binding === undefined || !isSignal(binding)) return undefined;
				return assign(context, current, binding, next);
			}
			case 'VariableDeclarator': {
				const init = current.init;
				if (init?.type !== 'CallExpression') return undefined;
				const rune = runes.get(init.callee);
				if (rune === undefined) return undefined;
				const binding = current.id.type === 'Identifier' ? declarations.get(current.id) : undefined;
				return { ...current, init: declare(context, rune, binding, init, next) };
			}
			default:
				return undefined;
		}
	});
}
