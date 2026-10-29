import type * as ES from 'estree';
import { close, open } from '../../shared/markers.ts';
import { hasAwait, ownExpressions } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type { Node } from '../ir/nodes.ts';
import { rewrite, runtime } from './script.ts';
import { Buffer, type TemplateContext } from './template.ts';

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

type Fragment = (
	context: TemplateContext,
	nodes: readonly Node[],
	statements: ES.Statement[],
	buffer: Buffer,
	textFirst: boolean
) => void;

export function asyncChild(
	context: TemplateContext,
	nodes: readonly Node[],
	expressions: readonly ES.Expression[],
	statements: ES.Statement[],
	buffer: Buffer,
	fragment: Fragment
): void {
	buffer.flush(context, statements);
	const out = b.id(context.names.unique('$$out'));
	const awaited = new Map(context.awaited ?? []);
	const body: ES.Statement[] = [];
	for (const expression of expressions) {
		const id = b.id(context.names.unique('$async'));
		awaited.set(expression, id);
		const value = b.call({
			type: 'AwaitExpression',
			argument: runtime(context, 'save', rewrite(context, expression))
		});
		body.push(b.constant(id.name, value));
	}
	const inner: TemplateContext = { ...context, out, awaited };
	const content = new Buffer();
	content.text(open);
	fragment(inner, nodes, body, content, false);
	content.text(close);
	content.flush(inner, body);
	statements.push(
		b.statement(b.call(b.member(context.out, 'child'), { ...b.arrow([out], body), async: true }))
	);
}
