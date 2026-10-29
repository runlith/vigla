import type * as ES from 'estree';
import { hasAwait, ownExpressions } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type { Namespace, Node } from '../ir/nodes.ts';
import { rewrite, runtime } from './script.ts';
import type { Emit, TemplateContext } from './template.ts';

export function awaiting(context: TemplateContext, nodes: readonly Node[]): ES.Expression[] {
	const found: ES.Expression[] = [];
	for (const node of nodes) {
		for (const expression of ownExpressions(node)) {
			if (context.awaited?.has(expression)) continue;
			if (hasAwait(expression)) found.push(expression);
		}
	}
	return found;
}

type Render = (
	context: TemplateContext,
	nodes: readonly Node[],
	anchor: ES.Identifier,
	namespace: Namespace,
	textFirst: boolean
) => ES.Statement[];

export function asyncSetup(
	context: TemplateContext,
	nodes: readonly Node[],
	expressions: readonly ES.Expression[],
	namespace: Namespace,
	render: Render
): (anchor: ES.Identifier, emit: Emit) => void {
	return (anchor, emit) => {
		const ids = expressions.map(() => b.id(context.names.unique('$async')));
		const awaited = new Map(context.awaited ?? []);
		expressions.forEach((expression, index) =>
			awaited.set(expression, ids[index] as ES.Identifier)
		);
		const inner: TemplateContext = { ...context, awaited };
		const thunks = expressions.map((expression) => ({
			...b.arrow([], rewrite(context, expression)),
			async: true
		}));
		const target = b.id(context.names.unique('$$anchor'));
		const body = render(inner, nodes, target, namespace, false);
		emit.init.push(
			b.statement(
				runtime(
					context,
					'async',
					anchor,
					{ type: 'ArrayExpression', elements: thunks },
					b.arrow([target, ...ids], body)
				)
			)
		);
	};
}
