import type * as ES from 'estree';
import * as b from '../ir/estree.ts';
import type { Binding as BindingNode, Element, Property, Text } from '../ir/nodes.ts';
import { rewrite } from './script.ts';
import type { TemplateContext } from './template.ts';

export interface BoundAttribute {
	readonly name: string;
	readonly value: ES.Expression;
	readonly boolean: boolean;
}

export interface Bound {
	readonly attributes: ReadonlyMap<BindingNode, BoundAttribute>;
	readonly content: ES.Expression | null;
	readonly raw: boolean;
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

export function bindings(context: TemplateContext, node: Element): Bound {
	let content: ES.Expression | null = null;
	let raw = false;
	const attributes = new Map<BindingNode, BoundAttribute>();
	for (const entry of node.attributes) {
		if (entry.kind !== 'binding') continue;
		const value = read(context, entry.expression);
		switch (entry.name) {
			case 'value': {
				const type = attribute(node, 'type');
				const file =
					node.name === 'input' &&
					type?.value.kind === 'text' &&
					type.value.parts.every((part) => part.kind === 'text') &&
					type.value.parts.map((part) => (part as Text).data).join('') === 'file';
				if (node.name === 'textarea') content = value;
				else if (!file) attributes.set(entry, { name: 'value', value, boolean: false });
				break;
			}
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
	return { attributes, content, raw };
}
