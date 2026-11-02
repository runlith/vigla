import type * as ES from 'estree';
import { hasAwait, ownExpressions } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type { Namespace, Node } from '../ir/nodes.ts';
import { asyncThunk, runtime } from './script.ts';
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

export function asyncThunks(
	context: TemplateContext,
	expressions: readonly ES.Expression[]
): ES.ArrowFunctionExpression[] {
	return expressions.map((expression) =>
		asyncThunk(context, expression, (value) => b.object({ value }))
	);
}

export function asyncSetup(
	context: TemplateContext,
	nodes: readonly Node[],
	expressions: readonly ES.Expression[],
	namespace: Namespace,
	render: Render,
	phase: 'init' | 'content' = 'init'
): (anchor: ES.Identifier, emit: Emit) => void {
	return (anchor, emit) => {
		const ids = expressions.map(() => b.id(context.names.unique('$async')));
		const awaited = new Map(context.awaited ?? []);
		expressions.forEach((expression, index) =>
			awaited.set(expression, ids[index] as ES.Identifier)
		);
		const inner: TemplateContext = { ...context, awaited };
		const thunks = asyncThunks(context, expressions);
		const target = b.id(context.names.unique('$$anchor'));
		const body = render(inner, nodes, target, namespace, false);
		const setup = runtime(
			context,
			phase === 'init' ? 'async' : 'prepareAsync',
			anchor,
			{ type: 'ArrayExpression', elements: thunks },
			b.arrow([target, ...ids], body)
		);
		if (phase === 'init') emit.init.push(b.statement(setup));
		else {
			const start = b.id(context.names.unique('$start'));
			emit.init.push(b.constant(start.name, setup));
			(emit.content ??= []).push(b.statement(b.call(start)));
		}
	};
}
