import type * as ES from 'estree';
import { spanOf, type ComponentAnalysis } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type { Span } from '../ir/nodes.ts';
import { rewrite, type Context } from './script.ts';

export interface Ownership {
	readonly validator: ES.Identifier;
	readonly ignored: readonly Span[];
}

export function ownership(analysis: ComponentAnalysis, names: b.Names): Ownership {
	const ignored: Span[] = [];
	for (const [node, codes] of [...analysis.unit.ignores, ...analysis.ignored]) {
		if (codes.has('ownership_invalid_mutation')) ignored.push(spanOf(node as ES.Node));
	}
	return { validator: b.id(names.unique('$$ownership')), ignored };
}

export function validateMutation(
	context: Context,
	node: ES.AssignmentExpression | ES.UpdateExpression,
	value: ES.Expression
): ES.Expression {
	const ownership = context.ownership;
	if (!context.dev || ownership === undefined || context.props === null) return value;
	let base: ES.Node = node.type === 'AssignmentExpression' ? node.left : node.argument;
	if (base.type !== 'MemberExpression') return value;
	const span = spanOf(base);
	if (ownership.ignored.some((ignored) => ignored.start <= span.start && ignored.end >= span.end))
		return value;
	const path: ES.Expression[] = [];
	while (base.type === 'MemberExpression') {
		const property = base.property;
		if (property.type !== 'Literal' && property.type !== 'Identifier') return value;
		path.unshift(
			base.computed ? rewrite(context, property) : b.literal((property as ES.Identifier).name)
		);
		base = base.object;
	}
	if (base.type !== 'Identifier') return value;
	const binding = context.analysis.references.get(base);
	if (binding?.kind !== 'prop' || binding.prop === null) return value;
	path.unshift(b.literal(base.name));
	const position = base.loc?.start;
	return b.call(
		b.member(ownership.validator, 'mutation'),
		b.literal(binding.prop.key),
		{ type: 'ArrayExpression', elements: path },
		value,
		b.literal(position?.line ?? 0),
		b.literal(position?.column ?? 0)
	);
}
