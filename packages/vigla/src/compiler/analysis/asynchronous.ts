import type * as ES from 'estree';
import { walk } from '../ir/estree.ts';
import type { Node, Value } from '../ir/nodes.ts';

export interface Settled {
	has(node: ES.Node): boolean;
}

export function awaits(node: ES.Node): ES.AwaitExpression[] {
	const found: ES.AwaitExpression[] = [];
	walk(node, (child) => {
		if (
			child.type === 'FunctionDeclaration' ||
			child.type === 'FunctionExpression' ||
			child.type === 'ArrowFunctionExpression' ||
			child.type === 'ClassBody'
		)
			return false;
		if (child.type === 'AwaitExpression') {
			found.push(child);
			return false;
		}
	});
	return found;
}

function evaluatedLast(node: ES.Node, parents: ReadonlyMap<ES.Node, ES.Node>): boolean {
	let child = node;
	for (let parent = parents.get(child); parent !== undefined; parent = parents.get(child)) {
		switch (parent.type) {
			case 'ArrayExpression':
				if (child !== parent.elements.at(-1)) return false;
				break;
			case 'AssignmentExpression':
			case 'BinaryExpression':
			case 'LogicalExpression':
				if (child === parent.left) return false;
				break;
			case 'CallExpression':
			case 'NewExpression':
				if (child !== parent.arguments.at(-1)) return false;
				break;
			case 'ConditionalExpression':
				if (child === parent.test) return false;
				break;
			case 'ObjectExpression':
				if (child !== parent.properties.at(-1)) return false;
				break;
			case 'Property':
				if (child === parent.key) return false;
				break;
			case 'SequenceExpression':
			case 'TemplateLiteral':
				if (child !== parent.expressions.at(-1)) return false;
				break;
			default:
				return false;
		}
		child = parent;
	}
	return true;
}

export function resuming(expression: ES.Node): ES.AwaitExpression[] {
	const parents = new Map<ES.Node, ES.Node>();
	const found: ES.AwaitExpression[] = [];
	walk(expression, (child, parent) => {
		if (parent !== null) parents.set(child, parent);
		if (
			child.type === 'FunctionDeclaration' ||
			child.type === 'FunctionExpression' ||
			child.type === 'ArrowFunctionExpression' ||
			child.type === 'ClassBody'
		)
			return false;
		if (child.type === 'AwaitExpression' && (found.length > 0 || !evaluatedLast(child, parents)))
			found.push(child);
	});
	return found;
}

export function hasAwait(node: ES.Node, settled?: Settled): boolean {
	let found = false;
	walk(node, (child) => {
		if (found || settled?.has(child)) return false;
		if (
			child.type === 'FunctionDeclaration' ||
			child.type === 'FunctionExpression' ||
			child.type === 'ArrowFunctionExpression' ||
			child.type === 'ClassBody'
		)
			return false;
		if (child.type === 'AwaitExpression' || (child.type === 'ForOfStatement' && child.await)) {
			found = true;
			return false;
		}
	});
	return found;
}

export function ownExpressions(node: Node): ES.Expression[] {
	const found: ES.Expression[] = [];
	const value = (given: Value): void => {
		if (given.kind === 'expression') found.push(given.expression);
		else if (given.kind === 'text') {
			for (const part of given.parts) if (part.kind === 'expression') found.push(part.expression);
		}
	};
	switch (node.kind) {
		case 'expression':
		case 'raw-html':
			found.push(node.expression);
			break;
		case 'element':
		case 'component':
		case 'dynamic-element':
		case 'boundary':
		case 'slot':
			if (node.kind === 'component') found.push(node.reference);
			if (node.kind === 'dynamic-element') found.push(node.tag);
			for (const attribute of node.attributes) {
				switch (attribute.kind) {
					case 'attribute':
					case 'style':
						value(attribute.value);
						break;
					case 'spread':
					case 'class':
					case 'attachment':
						found.push(attribute.expression);
						break;
					case 'action':
						found.push(attribute.action);
						if (attribute.argument !== null) found.push(attribute.argument);
						break;
					default:
						break;
				}
			}
			break;
		case 'branch':
			for (const arm of node.arms) found.push(arm.test);
			break;
		case 'keyed-list':
		case 'unkeyed-list':
			found.push(node.collection);
			break;
		case 'keyed-block':
			found.push(node.key);
			break;
		case 'async-block':
			found.push(node.promise);
			break;
		case 'render': {
			const call = (
				node.call.type === 'ChainExpression' ? node.call.expression : node.call
			) as ES.SimpleCallExpression;
			found.push(call.callee as ES.Expression);
			for (const argument of call.arguments) {
				if (argument.type !== 'SpreadElement') found.push(argument);
			}
			break;
		}
		default:
			break;
	}
	return found;
}

export function declaring(node: Node): boolean {
	return node.kind === 'constant' || node.kind === 'declaration';
}

export function pendingAwaits(node: Node, settled: Settled | undefined): ES.AwaitExpression[] {
	const inits =
		node.kind === 'constant'
			? [node.declarator.init]
			: node.kind === 'declaration'
				? node.declaration.declarations.map((declarator) => declarator.init)
				: [];
	return inits.flatMap((init) =>
		init == null ? [] : awaits(init).filter((found) => settled?.has(found) !== true)
	);
}

export interface AsyncStep {
	readonly before: readonly Node[];
	readonly rest: readonly Node[];
	readonly pending: readonly ES.AwaitExpression[];
}

export function asyncStep(nodes: readonly Node[], settled: Settled | undefined): AsyncStep | null {
	for (let index = 0; index < nodes.length; index++) {
		const node = nodes[index] as Node;
		if (!declaring(node)) continue;
		const pending = pendingAwaits(node, settled);
		if (pending.length === 0) continue;
		const earlier = nodes.slice(0, index);
		return {
			before: earlier.filter(declaring),
			rest: [...earlier.filter((other) => !declaring(other)), ...nodes.slice(index)],
			pending
		};
	}
	return null;
}
