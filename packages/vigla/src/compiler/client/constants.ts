import type * as ES from 'estree';
import { hasAwait, patternNames, pendingAwaits, spanOf, unsupported } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type { Constant, Declaration, Node } from '../ir/nodes.ts';
import { rewrite, runtime } from './script.ts';
import type { TemplateContext } from './template.ts';

function constantDeclaration(context: TemplateContext, node: Constant): ES.Statement[] {
	const { id, init } = node.declarator;
	if (init == null) throw unsupported(node, 'A {@const} without a value');
	if (hasAwait(init, context.awaited)) throw unsupported(spanOf(init), 'An await in {@const}');
	if (id.type === 'Identifier') {
		const value = runtime(context, 'derived', b.arrow([], rewrite(context, init)));
		return [b.constant(id.name, value)];
	}
	const names = patternNames(id);
	const bindings = names.map((name) => context.analysis.declarations.get(name));
	const plain = new Set(context.plain);
	for (const binding of bindings) if (binding !== undefined) plain.add(binding);
	const inner = { ...context, plain };
	const holder = b.id(context.names.unique('computed_const'));
	const body: ES.Statement[] = [
		{
			type: 'VariableDeclaration',
			kind: 'const',
			declarations: [
				{ type: 'VariableDeclarator', id: rewrite(inner, id), init: rewrite(context, init) }
			]
		},
		{
			type: 'ReturnStatement',
			argument: b.object(Object.fromEntries(names.map((name) => [name.name, b.id(name.name)])))
		}
	];
	names.forEach((name, index) => {
		const binding = bindings[index];
		if (binding === undefined) return;
		context.aliases?.set(binding, b.member(runtime(context, 'get', holder), name.name));
	});
	return [b.constant(holder.name, runtime(context, 'derived', b.arrow([], body)))];
}

function renamedPattern(pattern: ES.Pattern, names: ReadonlyMap<string, string>): ES.Pattern {
	switch (pattern.type) {
		case 'Identifier':
			return { ...pattern, name: names.get(pattern.name) ?? pattern.name };
		case 'AssignmentPattern':
			return { ...pattern, left: renamedPattern(pattern.left, names) };
		case 'ObjectPattern':
			return {
				...pattern,
				properties: pattern.properties.map((property) =>
					property.type === 'RestElement'
						? { ...property, argument: renamedPattern(property.argument, names) }
						: { ...property, value: renamedPattern(property.value, names), shorthand: false }
				)
			};
		case 'ArrayPattern':
			return {
				...pattern,
				elements: pattern.elements.map((element) =>
					element === null ? null : renamedPattern(element, names)
				)
			};
		case 'RestElement':
			return { ...pattern, argument: renamedPattern(pattern.argument, names) };
		default:
			return pattern;
	}
}

function nestedDeclaration(context: TemplateContext, node: Declaration): ES.Statement {
	if (pendingAwaits(node, context.awaited).length > 0)
		throw unsupported(node, 'An await in a declaration tag inside an element');
	const names = new Map<string, string>();
	for (const declarator of node.declaration.declarations) {
		for (const name of patternNames(declarator.id)) {
			const binding = context.analysis.declarations.get(name);
			const fresh = context.names.unique(name.name);
			names.set(name.name, fresh);
			if (binding !== undefined) context.renamed?.set(binding, fresh);
		}
	}
	const declaration = rewrite(context, node.declaration);
	return {
		...declaration,
		declarations: declaration.declarations.map((declarator) => ({
			...declarator,
			id: renamedPattern(declarator.id, names)
		}))
	};
}

export function constantDeclarations(
	context: TemplateContext,
	nodes: readonly Node[],
	own: ReadonlySet<Node> = new Set(nodes)
): ES.Statement[] {
	const result: ES.Statement[] = [];
	for (const node of nodes) {
		if (node.kind === 'constant') result.push(...constantDeclaration(context, node));
		else if (node.kind !== 'declaration') continue;
		else if (own.has(node)) result.push(rewrite(context, node.declaration));
		else result.push(nestedDeclaration(context, node));
	}
	return result;
}
