import type * as ES from 'estree';
import { spanOf, unsupported } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type { Boundary, Component, Node, Render, Snippet } from '../ir/nodes.ts';
import { bindThisCall } from './bindings.ts';
import { valueOf } from './element.ts';
import { rewrite, runtime } from './script.ts';
import { cleaned, isDynamic, render, type TemplateContext } from './template.ts';

function getter(name: string, value: ES.Expression): ES.Property {
	return {
		type: 'Property',
		key: b.literal(name),
		value: b.functionExpression([], [{ type: 'ReturnStatement', argument: value }]),
		kind: 'get',
		method: false,
		shorthand: false,
		computed: false
	};
}

function setter(name: string, param: ES.Identifier, body: ES.Statement[]): ES.Property {
	return {
		type: 'Property',
		key: b.literal(name),
		value: b.functionExpression([param], body),
		kind: 'set',
		method: false,
		shorthand: false,
		computed: false
	};
}

function plain(name: string, value: ES.Expression): ES.Property {
	return {
		type: 'Property',
		key: b.literal(name),
		value,
		kind: 'init',
		method: false,
		shorthand: false,
		computed: false
	};
}

export function isDynamicComponent(context: TemplateContext, node: Component): boolean {
	const reference = node.reference;
	if (reference.type === 'MemberExpression') return true;
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
			getter(name, b.call(rewrite(context, get))),
			setter(name, value, [b.statement(b.call(rewrite(context, set), value))])
		];
	}
	const assignment: ES.AssignmentExpression = {
		type: 'AssignmentExpression',
		operator: '=',
		left: expression as ES.Pattern,
		right: value
	};
	return [
		getter(name, rewrite(context, expression)),
		setter(name, value, [b.statement(rewrite(context, assignment))])
	];
}

export function propsObject(context: TemplateContext, node: Component): ES.Expression {
	const groups: (ES.Property[] | ES.Expression)[] = [];
	const push = (...properties: ES.Property[]): void => {
		const last = groups.at(-1);
		if (Array.isArray(last)) last.push(...properties);
		else groups.push([...properties]);
	};
	for (const attribute of node.attributes) {
		switch (attribute.kind) {
			case 'attribute': {
				const value = valueOf(context, null, attribute.value);
				const reactive =
					attribute.value.kind !== 'boolean' &&
					(attribute.value.kind === 'expression'
						? isDynamic(context, attribute.value.expression)
						: attribute.value.parts.some(
								(part) => part.kind === 'expression' && isDynamic(context, part.expression)
							));
				push(reactive ? getter(attribute.name, value) : plain(attribute.name, value));
				break;
			}
			case 'spread': {
				const value = rewrite(context, attribute.expression);
				groups.push(isDynamic(context, attribute.expression) ? b.arrow([], value) : value);
				break;
			}
			case 'binding':
				if (attribute.name === 'this') break;
				push(...bindingProperties(context, attribute.name, attribute.expression));
				break;
			default:
				throw unsupported(attribute, `The ${attribute.kind} directive on a component`);
		}
	}
	const nodes = cleaned(context, node.body);
	const regular: Node[] = [];
	for (const child of nodes) {
		if (child.kind === 'snippet') {
			push(plain(child.name.name, b.id(child.name.name)));
		} else {
			regular.push(child);
		}
	}
	if (regular.length > 0) {
		const anchor = b.id(context.names.unique('$$anchor'));
		const namespace = context.component.fragmentNamespaces.get(node.body) ?? 'html';
		const body = render(context, regular, anchor, namespace, true);
		push(plain('children', b.arrow([anchor], body)));
	}
	const objects = groups.map((group) =>
		Array.isArray(group)
			? ({ type: 'ObjectExpression', properties: group } as ES.ObjectExpression)
			: group
	);
	if (objects.length === 0) return { type: 'ObjectExpression', properties: [] };
	if (objects.length === 1 && groups[0] !== undefined && Array.isArray(groups[0])) {
		return objects[0] as ES.Expression;
	}
	return runtime(context, 'spreadProps', ...objects);
}

export function componentCall(
	context: TemplateContext,
	node: Component,
	anchor: ES.Expression
): ES.Statement[] {
	const declarations = snippetDeclarations(context, cleaned(context, node.body));
	const props = propsObject(context, node);
	const self = node.attributes.find(
		(attribute): attribute is Extract<typeof attribute, { kind: 'binding' }> =>
			attribute.kind === 'binding' && attribute.name === 'this'
	);
	const bound = (call: ES.Expression): ES.Expression =>
		self === undefined ? call : bindThisCall(context, call, self.expression);
	if (!isDynamicComponent(context, node)) {
		return [
			...declarations,
			b.statement(bound(b.call(rewrite(context, node.reference), anchor, props)))
		];
	}
	const inner = b.id(context.names.unique('$$anchor'));
	const reference = b.id(context.names.unique('$$component'));
	return [
		...declarations,
		b.statement(
			runtime(
				context,
				'component',
				anchor,
				b.arrow([], rewrite(context, node.reference)),
				b.arrow([inner, reference], bound(b.call(reference, inner, props)))
			)
		)
	];
}

export function boundaryCall(
	context: TemplateContext,
	node: Boundary,
	anchor: ES.Expression
): ES.Statement[] {
	const nodes = cleaned(context, node.body);
	const declarations = snippetDeclarations(context, nodes);
	const properties: ES.Property[] = [];
	const named = new Set<string>();
	for (const child of nodes) {
		if (
			child.kind === 'snippet' &&
			(child.name.name === 'failed' || child.name.name === 'pending')
		) {
			named.add(child.name.name);
			properties.push(plain(child.name.name, b.id(child.name.name)));
		}
	}
	for (const attribute of node.attributes) {
		if (attribute.kind !== 'attribute' || named.has(attribute.name)) continue;
		const value = valueOf(context, null, attribute.value);
		properties.push(getter(attribute.name, value));
	}
	const regular = nodes.filter(
		(child) => !(child.kind === 'snippet' && named.has(child.name.name))
	);
	const inner = b.id(context.names.unique('$$anchor'));
	const namespace = context.component.fragmentNamespaces.get(node.body) ?? 'html';
	const body = render(
		context,
		regular.filter((child) => child.kind !== 'snippet'),
		inner,
		namespace,
		true
	);
	return [
		...declarations,
		b.statement(
			runtime(
				context,
				'boundary',
				anchor,
				{ type: 'ObjectExpression', properties },
				b.arrow([inner], body)
			)
		)
	];
}

export function snippetDeclarations(
	context: TemplateContext,
	nodes: readonly Node[]
): ES.Statement[] {
	const result: ES.Statement[] = [];
	for (const node of nodes)
		if (node.kind === 'snippet') result.push(snippetDeclaration(context, node));
	return result;
}

function snippetDeclaration(context: TemplateContext, node: Snippet): ES.FunctionDeclaration {
	const anchor = b.id(context.names.unique('$$anchor'));
	const params = node.parameters.map((parameter) => ({
		type: 'AssignmentPattern' as const,
		left: parameter as ES.Identifier,
		right: b.member(context.runtime, 'noop')
	}));
	const namespace = context.component.fragmentNamespaces.get(node.body) ?? 'html';
	const body = render(context, cleaned(context, node.body), anchor, namespace, true);
	return {
		type: 'FunctionDeclaration',
		id: node.name,
		params: [anchor, ...params],
		body: { type: 'BlockStatement', body },
		async: false,
		generator: false
	};
}

function callOf(node: Render): { call: ES.SimpleCallExpression; optional: boolean } {
	const expression = node.call;
	if (expression.type === 'ChainExpression') {
		return { call: expression.expression as ES.SimpleCallExpression, optional: true };
	}
	return { call: expression, optional: expression.optional };
}

export function isStaticRender(context: TemplateContext, node: Render): boolean {
	const { call, optional } = callOf(node);
	if (optional || call.callee.type !== 'Identifier') return false;
	const binding = context.analysis.references.get(call.callee);
	return binding?.kind === 'snippet' && !binding.reassigned;
}

export function renderCall(
	context: TemplateContext,
	node: Render,
	anchor: ES.Expression
): ES.Statement[] {
	const { call } = callOf(node);
	const args = call.arguments.map((argument) => {
		if (argument.type === 'SpreadElement')
			throw unsupported(spanOf(argument), 'A spread argument to a snippet');
		return b.arrow([], rewrite(context, argument));
	});
	if (isStaticRender(context, node)) {
		return [b.statement(b.call(call.callee as ES.Identifier, anchor, ...args))];
	}
	const callee = rewrite(context, call.callee as ES.Expression);
	return [b.statement(runtime(context, 'render', anchor, b.arrow([], callee), ...args))];
}
