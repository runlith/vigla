import type * as ES from 'estree';
import * as b from '../ir/estree.ts';
import type { Expression, Text, Value } from '../ir/nodes.ts';
import { rewrite } from './script.ts';
import { isDynamic, memo, type Emit, type TemplateContext } from './template.ts';

export function valueReactive(context: TemplateContext, value: Value): boolean {
	if (value.kind === 'boolean') return false;
	if (value.kind === 'expression') return isDynamic(context, value.expression);
	return value.parts.some(
		(part) => part.kind === 'expression' && isDynamic(context, part.expression)
	);
}

export function isStatic(value: Value): boolean {
	return (
		value.kind === 'boolean' ||
		(value.kind === 'text' && value.parts.every((part) => part.kind === 'text'))
	);
}

export function staticText(value: Value): string {
	return value.kind === 'text' ? value.parts.map((part) => (part as Text).data).join('') : '';
}

export function valueOf(context: TemplateContext, emit: Emit | null, value: Value): ES.Expression {
	if (value.kind === 'boolean') return b.literal(true);
	if (value.kind === 'expression') {
		const rewritten = rewrite(context, value.expression);
		return emit === null ? rewritten : memo(context, emit, value.expression, rewritten);
	}
	const run = value.parts;
	const [only] = run;
	if (run.length === 1 && only?.kind === 'expression') {
		const rewritten = rewrite(context, only.expression);
		const memoized = emit === null ? rewritten : memo(context, emit, only.expression, rewritten);
		return b.logical('??', memoized, b.literal(''));
	}
	const quasis: string[] = [''];
	const expressions: ES.Expression[] = [];
	for (const part of run) {
		if (part.kind === 'text') quasis[quasis.length - 1] += part.data;
		else {
			const rewritten = rewrite(context, (part as Expression).expression);
			const memoized =
				emit === null ? rewritten : memo(context, emit, (part as Expression).expression, rewritten);
			expressions.push(b.logical('??', memoized, b.literal('')));
			quasis.push('');
		}
	}
	return b.template(quasis, expressions);
}
