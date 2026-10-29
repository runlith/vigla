import type * as ES from 'estree';
import { hasAwait, patternNames, spanOf, unsupported } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type { Constant, Node } from '../ir/nodes.ts';
import { rewrite, runtime } from './script.ts';
import type { TemplateContext } from './template.ts';

function constantDeclaration(context: TemplateContext, node: Constant): ES.Statement[] {
	const { id, init } = node.declarator;
	if (init == null) throw unsupported(node, 'A {@const} without a value');
	if (hasAwait(init)) throw unsupported(spanOf(init), 'An await in {@const}');
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

export function constantDeclarations(
	context: TemplateContext,
	nodes: readonly Node[]
): ES.Statement[] {
	const result: ES.Statement[] = [];
	for (const node of nodes)
		if (node.kind === 'constant') result.push(...constantDeclaration(context, node));
	return result;
}
