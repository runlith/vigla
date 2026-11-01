import type * as ES from 'estree';
import * as b from '../ir/estree.ts';
import type { Binding as BindingNode, Element, Property, Text } from '../ir/nodes.ts';
import { rewrite, runtime } from './script.ts';
import type { Buffer, TemplateContext } from './template.ts';

export interface BoundAttribute {
	readonly name: string;
	readonly value: ES.Expression;
	readonly boolean: boolean;
}

export interface Bound {
	readonly attributes: ReadonlyMap<BindingNode, BoundAttribute>;
	readonly content: ES.Expression | null;
	readonly raw: boolean;
	readonly select: ES.Expression | null;
}

function read(context: TemplateContext, expression: ES.Expression): ES.Expression {
	if (expression.type === 'SequenceExpression') {
		return b.call(rewrite(context, expression.expressions[0] as ES.Expression));
	}
	return rewrite(context, expression);
}

function attribute(node: Element, name: string): Property | undefined {
	return node.attributes.find(
		(candidate): candidate is Property => candidate.kind === 'attribute' && candidate.name === name
	);
}

function valueOf(context: TemplateContext, property: Property | undefined): ES.Expression | null {
	if (property === undefined) return null;
	const value = property.value;
	if (value.kind === 'boolean') return b.literal('');
	if (value.kind === 'expression') return rewrite(context, value.expression);
	if (value.parts.every((part) => part.kind === 'text')) {
		return b.literal(value.parts.map((part) => (part as Text).data).join(''));
	}
	return null;
}

function staticText(context: TemplateContext, node: Element): ES.Expression | null {
	const nodes = context.component.fragments.get(node.body) ?? [];
	if (!nodes.every((child) => child.kind === 'text')) return null;
	return b.literal(nodes.map((child) => (child as Text).data).join(''));
}

export function bindings(context: TemplateContext, node: Element, buffer: Buffer): Bound {
	let content: ES.Expression | null = null;
	let raw = false;
	let select: ES.Expression | null = null;
	const attributes = new Map<BindingNode, BoundAttribute>();
	for (const entry of node.attributes) {
		if (entry.kind !== 'binding') continue;
		const value = read(context, entry.expression);
		switch (entry.name) {
			case 'value':
				if (node.name === 'textarea') content = value;
				else if (node.name === 'select') select = value;
				else attributes.set(entry, { name: 'value', value, boolean: false });
				break;
			case 'checked':
				attributes.set(entry, { name: 'checked', value, boolean: true });
				break;
			case 'open':
				attributes.set(entry, { name: 'open', value, boolean: true });
				break;
			case 'group': {
				const own = valueOf(context, attribute(node, 'value'));
				if (own === null) break;
				const type = attribute(node, 'type');
				const checkbox =
					type?.value.kind === 'text' &&
					type.value.parts.every((part) => part.kind === 'text') &&
					type.value.parts.map((part) => (part as Text).data).join('') === 'checkbox';
				const test = checkbox
					? b.call(
							b.member(
								b.logical('??', value, { type: 'ArrayExpression', elements: [] }),
								'includes'
							),
							own
						)
					: b.binary('===', own, value);
				attributes.set(entry, { name: 'checked', value: test, boolean: true });
				break;
			}
			case 'innerHTML':
				content = value;
				raw = true;
				break;
			case 'textContent':
			case 'innerText':
				content = value;
				break;
			default:
				break;
		}
	}
	if (node.name === 'select' && select === null) {
		const given = attribute(node, 'value');
		if (given !== undefined) select = valueOf(context, given);
	}
	if (node.name === 'option') {
		const own = valueOf(context, attribute(node, 'value')) ?? staticText(context, node);
		if (own !== null) buffer.value(runtime(context, 'optionSelected', own));
	}
	return { attributes, content, raw, select };
}
