import type * as ES from 'estree';
import { hash } from '../../shared/hash.ts';
import { hasAwait, unsupported } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type { Fragment, Special, Title } from '../ir/nodes.ts';
import { rewrite, runtime } from './script.ts';
import { cleaned, render, type TemplateContext } from './template.ts';

export function headHash(context: TemplateContext): string {
	return hash((context.component.unit.filename ?? '(unknown)').replace(/\\/g, '/'));
}

export function titleValue(
	context: TemplateContext,
	parts: Title['parts'],
	text: (expression: ES.Expression) => ES.Expression
): ES.Expression {
	const [only] = parts;
	if (parts.length === 1 && only?.kind === 'expression') {
		return b.logical('??', text(rewrite(context, only.expression)), b.literal(''));
	}
	const quasis: string[] = [''];
	const expressions: ES.Expression[] = [];
	for (const part of parts) {
		if (part.kind === 'text') quasis[quasis.length - 1] += part.data;
		else {
			expressions.push(b.logical('??', text(rewrite(context, part.expression)), b.literal('')));
			quasis.push('');
		}
	}
	return expressions.length === 0 ? b.literal(quasis[0] ?? '') : b.template(quasis, expressions);
}

function titleCode(context: TemplateContext, node: Title): ES.Statement {
	const pending = node.parts
		.filter((part) => part.kind === 'expression')
		.map((part) => part.expression)
		.filter((expression) => !context.awaited?.has(expression) && hasAwait(expression));
	const awaited = new Map(context.awaited ?? []);
	const ids = pending.map((expression) => {
		const id = b.id(context.names.unique('$async'));
		awaited.set(expression, id);
		return id;
	});
	const inner: TemplateContext = { ...context, awaited };
	const value = titleValue(inner, node.parts, (expression) => expression);
	const effect = b.statement(
		runtime(context, 'effect', b.arrow([], runtime(context, 'title', value)))
	);
	if (pending.length === 0) return effect;
	const thunks = pending.map((expression) => ({
		...b.arrow([], rewrite(context, expression)),
		async: true
	}));
	return b.statement(
		runtime(
			context,
			'async',
			b.literal(null),
			{ type: 'ArrayExpression', elements: thunks },
			b.arrow([b.id(context.names.unique('$$anchor')), ...ids], [effect])
		)
	);
}

function headCode(context: TemplateContext, node: Special): ES.Statement {
	const anchor = b.id(context.names.unique('$$anchor'));
	const body = [
		...render(context, cleaned(context, node.body), anchor, 'html', false),
		...separateCode(context, node.body)
	];
	return b.statement(
		runtime(context, 'head', b.literal(headHash(context)), b.arrow([anchor], body))
	);
}

export function separateCode(context: TemplateContext, fragment: Fragment): ES.Statement[] {
	const statements: ES.Statement[] = [];
	for (const node of context.component.separate.get(fragment) ?? []) {
		if (node.kind === 'title') statements.push(titleCode(context, node));
		else if (node.target === 'head') statements.push(headCode(context, node));
		else throw unsupported(node, `<svelte:${node.target}>`);
	}
	return statements;
}
