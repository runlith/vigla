import type * as ES from 'estree';
import { close, empty, open, openElse } from '../../shared/markers.ts';
import { spanOf, unsupported } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type {
	Boundary,
	Component,
	Expression,
	Node,
	Render,
	Snippet,
	Text,
	Value
} from '../ir/nodes.ts';
import { rewrite, runtime } from './script.ts';
import { Buffer, fragmentCode, type TemplateContext } from './template.ts';

function property(
	name: string,
	value: ES.Expression,
	kind: 'init' | 'get' | 'set' = 'init'
): ES.Property {
	return {
		type: 'Property',
		key: b.literal(name),
		value,
		kind,
		method: false,
		shorthand: false,
		computed: false
	};
}

function valueOf(context: TemplateContext, value: Value): ES.Expression {
	if (value.kind === 'boolean') return b.literal(true);
	if (value.kind === 'expression') return rewrite(context, value.expression);
	const quasis: string[] = [''];
	const expressions: ES.Expression[] = [];
	for (const part of value.parts) {
		if (part.kind === 'text') quasis[quasis.length - 1] += (part as Text).data;
		else {
			expressions.push(
				b.logical('??', rewrite(context, (part as Expression).expression), b.literal(''))
			);
			quasis.push('');
		}
	}
	return b.template(quasis, expressions);
}

export function isDynamicComponent(context: TemplateContext, node: Component): boolean {
	const reference = node.reference;
	if (reference.type !== 'Identifier') return true;
	const binding = context.analysis.references.get(reference);
	if (binding === undefined) return false;
	return (binding.kind !== 'normal' && binding.kind !== 'import') || binding.reassigned;
}

function bindingProperties(
	context: TemplateContext,
	name: string,
	expression: ES.Expression
): ES.Property[] {
	const value = b.id(context.names.unique('$$value'));
	if (expression.type === 'SequenceExpression') {
		const [get, set] = expression.expressions as [ES.Expression, ES.Expression];
		return [
			property(
				name,
				b.functionExpression(
					[],
					[{ type: 'ReturnStatement', argument: b.call(rewrite(context, get)) }]
				),
				'get'
			),
			property(
				name,
				b.functionExpression([value], [b.statement(b.call(rewrite(context, set), value))]),
				'set'
			)
		];
	}
	const assignment: ES.AssignmentExpression = {
		type: 'AssignmentExpression',
		operator: '=',
		left: expression as ES.Pattern,
		right: value
	};
	return [
		property(
			name,
			b.functionExpression(
				[],
				[{ type: 'ReturnStatement', argument: rewrite(context, expression) }]
			),
			'get'
		),
		property(
			name,
			b.functionExpression([value], [b.statement(rewrite(context, assignment))]),
			'set'
		)
	];
}

function propsObject(context: TemplateContext, node: Component): ES.Expression {
	const groups: (ES.Property[] | ES.Expression)[] = [];
	const push = (...properties: ES.Property[]): void => {
		const last = groups.at(-1);
		if (Array.isArray(last)) last.push(...properties);
		else groups.push([...properties]);
	};
	for (const attribute of node.attributes) {
		switch (attribute.kind) {
			case 'attribute':
				push(property(attribute.name, valueOf(context, attribute.value)));
				break;
			case 'spread':
				groups.push(rewrite(context, attribute.expression));
				break;
			case 'binding':
				if (attribute.name === 'this') break;
				push(...bindingProperties(context, attribute.name, attribute.expression));
				break;
			case 'attachment':
				break;
			default:
				throw unsupported(attribute, `The ${attribute.kind} directive on a component`);
		}
	}
	const nodes = context.component.fragments.get(node.body) ?? [];
	const regular: Node[] = [];
	for (const child of nodes) {
		if (child.kind === 'snippet') push(property(child.name.name, b.id(child.name.name)));
		else regular.push(child);
	}
	if (regular.length > 0) {
		const out = b.id(context.names.unique('$$out'));
		const inner: TemplateContext = { ...context, out };
		const statements: ES.Statement[] = [];
		const buffer = new Buffer();
		fragmentCode(inner, regular, statements, buffer, true);
		buffer.flush(inner, statements);
		push(property('children', b.arrow([out], statements)));
	}
	const objects = groups.map((group) =>
		Array.isArray(group)
			? ({ type: 'ObjectExpression', properties: group } as ES.ObjectExpression)
			: group
	);
	if (objects.length === 0) return { type: 'ObjectExpression', properties: [] };
	if (objects.length === 1 && Array.isArray(groups[0])) return objects[0] as ES.Expression;
	return runtime(context, 'spreadProps', ...objects);
}

export function component(
	context: TemplateContext,
	node: Component,
	statements: ES.Statement[],
	buffer: Buffer,
	alone: boolean
): void {
	buffer.flush(context, statements);
	statements.push(
		...snippetDeclarations(context, context.component.fragments.get(node.body) ?? [])
	);
	const props = propsObject(context, node);
	const reference = rewrite(context, node.reference);
	const call = b.statement(b.call(reference, context.out, props));
	if (!isDynamicComponent(context, node)) {
		statements.push(call);
		if (!alone) buffer.text(empty);
		return;
	}
	const push = (html: string): ES.Statement =>
		b.statement(b.call(b.member(context.out, 'push'), b.literal(html)));
	statements.push({
		type: 'IfStatement',
		test: reference,
		consequent: { type: 'BlockStatement', body: [push(open), call, push(close)] },
		alternate: { type: 'BlockStatement', body: [push(openElse), push(close)] }
	});
}

export function boundary(
	context: TemplateContext,
	node: Boundary,
	statements: ES.Statement[],
	buffer: Buffer
): void {
	buffer.flush(context, statements);
	const nodes = context.component.fragments.get(node.body) ?? [];
	statements.push(...snippetDeclarations(context, nodes));
	const snippet = (name: string): ES.Expression | null => {
		if (nodes.some((child) => child.kind === 'snippet' && child.name.name === name))
			return b.id(name);
		const attribute = node.attributes.find(
			(candidate) => candidate.kind === 'attribute' && candidate.name === name
		);
		return attribute?.kind === 'attribute' ? valueOf(context, attribute.value) : null;
	};
	const pending = snippet('pending');
	const failed = snippet('failed');
	const regular = nodes.filter(
		(child) =>
			child.kind !== 'snippet' || (child.name.name !== 'failed' && child.name.name !== 'pending')
	);
	const out = failed === null ? context.out : b.id(context.names.unique('$$out'));
	const inner: TemplateContext = { ...context, out };
	const body: ES.Statement[] = [];
	if (pending !== null) {
		body.push(
			b.statement(b.call(b.member(out, 'push'), b.literal(openElse))),
			b.statement(b.call(pending, out)),
			b.statement(b.call(b.member(out, 'push'), b.literal(close)))
		);
	} else {
		const children = new Buffer();
		children.text(open);
		fragmentCode(
			inner,
			regular.filter((child) => child.kind !== 'snippet'),
			body,
			children,
			true
		);
		children.text(close);
		children.flush(inner, body);
	}
	if (failed === null) {
		statements.push({ type: 'BlockStatement', body });
		return;
	}
	statements.push(
		b.statement(
			runtime(
				context,
				'boundary',
				context.out,
				{ type: 'ObjectExpression', properties: [property('failed', failed)] },
				b.arrow([out], body)
			)
		)
	);
}

export function snippetDeclarations(
	context: TemplateContext,
	nodes: readonly Node[]
): ES.Statement[] {
	const result: ES.Statement[] = [];
	for (const node of nodes) {
		if (node.kind !== 'snippet') continue;
		if (context.component.lifted.has(node)) {
			context.hoisted.push(snippetDeclaration({ ...context, props: null }, node));
		} else {
			result.push(snippetDeclaration(context, node));
		}
	}
	return result;
}

function snippetDeclaration(context: TemplateContext, node: Snippet): ES.FunctionDeclaration {
	const out = b.id(context.names.unique('$$out'));
	const inner: TemplateContext = { ...context, out };
	const statements: ES.Statement[] = [];
	const buffer = new Buffer();
	fragmentCode(inner, context.component.fragments.get(node.body) ?? [], statements, buffer, true);
	buffer.flush(inner, statements);
	return {
		type: 'FunctionDeclaration',
		id: node.name,
		params: [out, ...(node.parameters as ES.Pattern[])],
		body: { type: 'BlockStatement', body: statements },
		async: false,
		generator: false
	};
}

export function isStaticRender(context: TemplateContext, node: Render): boolean {
	const expression = node.call;
	if (expression.type === 'ChainExpression' || expression.optional) return false;
	if (expression.callee.type !== 'Identifier') return false;
	const binding = context.analysis.references.get(expression.callee);
	return binding?.kind === 'snippet' && !binding.reassigned;
}

export function render(
	context: TemplateContext,
	node: Render,
	statements: ES.Statement[],
	buffer: Buffer,
	alone: boolean
): void {
	buffer.flush(context, statements);
	const chained = node.call.type === 'ChainExpression';
	const call = (
		chained ? (node.call as ES.ChainExpression).expression : node.call
	) as ES.SimpleCallExpression;
	const args = call.arguments.map((argument) => {
		if (argument.type === 'SpreadElement')
			throw unsupported(spanOf(argument), 'A spread argument to a snippet');
		return rewrite(context, argument);
	});
	const invoked: ES.SimpleCallExpression = {
		type: 'CallExpression',
		callee: rewrite(context, call.callee as ES.Expression),
		arguments: [context.out, ...args],
		optional: chained || call.optional
	};
	statements.push(
		b.statement(
			chained || call.optional ? { type: 'ChainExpression', expression: invoked } : invoked
		)
	);
	if (!alone) buffer.text(empty);
}

export function standalone(context: TemplateContext, nodes: readonly Node[]): boolean {
	const regular = nodes.filter((node) => node.kind !== 'snippet' && node.kind !== 'constant');
	if (regular.length !== 1) return false;
	const [only] = regular;
	if (only?.kind === 'component') return !isDynamicComponent(context, only);
	if (only?.kind === 'render') return isStaticRender(context, only);
	return false;
}
