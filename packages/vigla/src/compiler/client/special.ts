import type * as ES from 'estree';
import { hash } from '../../shared/hash.ts';
import { hasAwait, unsupported } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import { isCapture } from '../../shared/html.ts';
import type { Binding as BindingNode, Fragment, Special, Title } from '../ir/nodes.ts';
import { accessors } from './bindings.ts';
import { asyncThunks } from './asynchronous.ts';
import { actionCall, attachCall } from './directives.ts';
import { handler, named } from './events.ts';
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
	const thunks = asyncThunks(context, pending);
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

function targetOf(node: Special): ES.Expression {
	if (node.target === 'window') return b.id('window');
	if (node.target === 'document') return b.id('document');
	return b.member(b.id('document'), 'body');
}

const documentEvents: Readonly<Record<string, string>> = {
	fullscreenElement: 'fullscreenchange',
	pointerLockElement: 'pointerlockchange',
	visibilityState: 'visibilitychange'
};

function targetBinding(
	context: TemplateContext,
	target: ES.Expression,
	node: BindingNode
): ES.Expression {
	const { get, set } = accessors(context, node.expression);
	const name = node.name;
	switch (name) {
		case 'innerWidth':
		case 'innerHeight':
		case 'outerWidth':
		case 'outerHeight':
			return runtime(context, 'bindWindowSize', b.literal(name), set);
		case 'scrollX':
		case 'scrollY':
			return runtime(
				context,
				'bindWindowScroll',
				b.literal(name === 'scrollX' ? 'x' : 'y'),
				get,
				set
			);
		case 'online':
			return runtime(context, 'bindOnline', set);
		case 'devicePixelRatio':
			return runtime(context, 'bindProperty', b.literal(name), b.literal('resize'), target, set);
		case 'activeElement':
			return runtime(context, 'bindActiveElement', set);
		default: {
			const event = documentEvents[name];
			if (event === undefined) throw unsupported(node, `bind:${name}`);
			return runtime(context, 'bindProperty', b.literal(name), b.literal(event), target, set);
		}
	}
}

function targetCode(context: TemplateContext, node: Special): ES.Statement[] {
	const target = targetOf(node);
	const statements: ES.Statement[] = [];
	for (const attribute of node.attributes) {
		switch (attribute.kind) {
			case 'attribute': {
				if (attribute.value.kind !== 'expression' || !/^on/i.test(attribute.name)) {
					throw unsupported(
						attribute,
						`The ${attribute.name} attribute on <svelte:${node.target}>`
					);
				}
				let type = attribute.name.slice(2).toLowerCase();
				const capture = isCapture(type);
				if (capture) type = type.slice(0, -7);
				const args: ES.Expression[] = [
					target,
					b.literal(type),
					named(context, type, handler(context, attribute.value.expression, statements))
				];
				if (capture) args.push(b.literal(true));
				statements.push(b.statement(runtime(context, 'on', ...args)));
				break;
			}
			case 'binding':
				statements.push(b.statement(targetBinding(context, target, attribute)));
				break;
			case 'action':
				statements.push(actionCall(context, target, attribute));
				break;
			case 'attachment':
				statements.push(attachCall(context, target, attribute));
				break;
			default:
				throw unsupported(attribute, `The ${attribute.kind} directive on <svelte:${node.target}>`);
		}
	}
	return statements;
}

export function separateCode(context: TemplateContext, fragment: Fragment): ES.Statement[] {
	const statements: ES.Statement[] = [];
	for (const node of context.component.separate.get(fragment) ?? []) {
		if (node.kind === 'title') statements.push(titleCode(context, node));
		else if (node.target === 'head') statements.push(headCode(context, node));
		else statements.push(...targetCode(context, node));
	}
	return statements;
}
