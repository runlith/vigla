import type * as ES from 'estree';
import type { Binding, ComponentAnalysis } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type { Slot } from '../ir/nodes.ts';
import { valueOf } from './values.ts';
import { read, rewrite, runtime } from './script.ts';
import { cleaned, render, type TemplateContext } from './template.ts';

function properties(analysis: ComponentAnalysis): Binding[] {
	return [...new Set(analysis.declarations.values())].filter((binding) => binding.kind === 'prop');
}

function propertyName(node: ES.Property): string {
	return node.key.type === 'Identifier' ? node.key.name : String((node.key as ES.Literal).value);
}

export function accessors(context: TemplateContext): ES.Property[] {
	if (context.component.customElement === null) return [];
	const result: ES.Property[] = [];
	for (const binding of properties(context.component)) {
		const key = b.literal(binding.prop!.key);
		const local = b.id(binding.name);
		result.push({
			type: 'Property',
			key,
			value: b.functionExpression(
				[],
				[{ type: 'ReturnStatement', argument: read(context, local, binding)! }]
			),
			kind: 'get',
			method: false,
			shorthand: false,
			computed: false
		});
		const value = b.id(context.names.unique('$$value'));
		result.push({
			type: 'Property',
			key,
			value: b.functionExpression(
				[value],
				[b.statement(b.call(local, value)), b.statement(runtime(context, 'flushSync'))]
			),
			kind: 'set',
			method: false,
			shorthand: false,
			computed: false
		});
	}
	return result;
}

export function customElement(
	context: TemplateContext,
	name: string,
	exports: ES.Property[],
	hmr: boolean
): ES.Statement[] {
	const definition = context.component.customElement;
	if (definition === null) return [];
	const bindings = properties(context.component);
	const named = new Map<string, Binding>();
	const props: Record<string, ES.Expression> = {};
	for (const binding of bindings) {
		const key = binding.prop!.key;
		props[key] = b.object({});
		if (!named.has(binding.name)) named.set(binding.name, binding);
		if (!named.has(key)) named.set(key, binding);
	}
	for (const property of definition.props?.properties ?? []) {
		if (property.type !== 'Property') continue;
		const key = propertyName(property);
		const binding = named.get(key);
		let value = rewrite(context, property.value as ES.Expression);
		const initial = binding?.prop?.fallback;
		if (
			value.type === 'ObjectExpression' &&
			initial?.type === 'Literal' &&
			typeof initial.value === 'boolean' &&
			!value.properties.some(
				(property) => property.type === 'Property' && propertyName(property) === 'type'
			)
		)
			value = {
				...value,
				properties: [...value.properties, ...b.object({ type: b.literal('Boolean') }).properties]
			};
		props[binding?.prop?.key ?? key] = value;
	}
	const shadow = definition.shadow;
	const create = runtime(
		context,
		'customElement',
		b.id(name),
		b.object(props),
		{
			type: 'ArrayExpression',
			elements: [...new Set(exports.map(propertyName))].map((name) => b.literal(name))
		},
		shadow === 'none'
			? b.id('undefined')
			: typeof shadow === 'object' && shadow !== null
				? shadow
				: b.object({ mode: b.literal('open') }),
		definition.extend ?? b.id('undefined')
	);
	const registration = b.statement(
		definition.tag === null
			? create
			: b.call(b.member(b.id('customElements'), 'define'), b.literal(definition.tag), create)
	);
	if (!hmr || definition.tag === null) return [registration];
	return [
		{
			type: 'IfStatement',
			test: b.binary(
				'==',
				b.call(b.member(b.id('customElements'), 'get'), b.literal(definition.tag)),
				b.literal(null)
			),
			consequent: registration,
			alternate: null
		}
	];
}

export function slotCall(
	context: TemplateContext,
	node: Slot,
	anchor: ES.Identifier
): ES.Statement {
	const inner = b.id(context.names.unique('$$anchor'));
	const namespace = context.component.fragmentNamespaces.get(node.fallback) ?? 'html';
	const fallback = cleaned(context, node.fallback);
	const props: ES.ObjectExpression = { type: 'ObjectExpression', properties: [] };
	for (const attribute of node.attributes) {
		if (attribute.kind === 'spread')
			props.properties.push({
				type: 'SpreadElement',
				argument: rewrite(context, attribute.expression)
			});
		else if (
			attribute.kind === 'attribute' &&
			attribute.name !== 'name' &&
			attribute.name !== 'slot'
		) {
			props.properties.push({
				type: 'Property',
				key: b.literal(attribute.name),
				value: b.functionExpression(
					[],
					[{ type: 'ReturnStatement', argument: valueOf(context, null, attribute.value) }]
				),
				kind: 'get',
				method: false,
				shorthand: false,
				computed: false
			});
		}
	}
	return b.statement(
		runtime(
			context,
			'slot',
			anchor,
			context.props!,
			b.literal(node.name ?? 'default'),
			props,
			fallback.length === 0
				? b.literal(null)
				: b.arrow([inner], render(context, fallback, inner, namespace, true))
		)
	);
}
