import type * as ES from 'estree';
import { escapeContent } from '../../shared/escape.ts';
import { hash } from '../../shared/hash.ts';
import { hasAwait } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type { Fragment, Special, Title } from '../ir/nodes.ts';
import { asyncThunk, inSegment, rewrite, runtime } from './script.ts';
import { Buffer, fragmentCode, type TemplateContext } from './template.ts';

function titleCode(context: TemplateContext, node: Title): ES.Statement {
	const out = b.id(context.names.unique('$$out'));
	const segment = b.id(context.names.unique('$$segment'));
	const buffer = new Buffer();
	const statements: ES.Statement[] = [];
	const awaited = new Map(context.awaited ?? []);
	for (const part of node.parts) {
		if (part.kind !== 'expression') continue;
		if (awaited.has(part.expression) || !hasAwait(part.expression)) continue;
		const id = b.id(context.names.unique('$async'));
		awaited.set(part.expression, id);
		const thunk = b.call(asyncThunk(context, part.expression));
		const saved = runtime(context, 'save', thunk, { ...segment });
		const value = b.member(b.call({ type: 'AwaitExpression', argument: saved }), 'value');
		statements.push(b.constant(id.name, value));
	}
	const asynchronous = statements.length > 0;
	const inner: TemplateContext = { ...context, out, awaited };
	buffer.text('<title>');
	for (const part of node.parts) {
		if (part.kind === 'text') buffer.text(escapeContent(part.data));
		else buffer.value(runtime(inner, 'escape', rewrite(inner, part.expression)));
	}
	buffer.text('</title>');
	buffer.flush(inner, statements);
	const body = asynchronous ? inSegment(context, segment, statements) : statements;
	const fn = { ...b.arrow([out], body), async: asynchronous };
	return b.statement(b.call(b.member(context.out, 'title'), fn));
}

function headCode(context: TemplateContext, node: Special): ES.Statement {
	const out = b.id(context.names.unique('$$out'));
	const inner: TemplateContext = { ...context, out };
	const statements: ES.Statement[] = [...separateCode(inner, node.body)];
	const buffer = new Buffer();
	fragmentCode(inner, context.component.fragments.get(node.body) ?? [], statements, buffer, false);
	buffer.flush(inner, statements);
	const hashed = hash((context.component.unit.filename ?? '(unknown)').replace(/\\/g, '/'));
	return b.statement(
		runtime(context, 'head', context.out, b.literal(hashed), b.arrow([out], statements))
	);
}

export function separateCode(context: TemplateContext, fragment: Fragment): ES.Statement[] {
	const statements: ES.Statement[] = [];
	for (const node of context.component.separate.get(fragment) ?? []) {
		if (node.kind === 'title') statements.push(titleCode(context, node));
		else if (node.target === 'head') statements.push(headCode(context, node));
	}
	return statements;
}
