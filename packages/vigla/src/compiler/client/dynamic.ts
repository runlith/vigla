import type * as ES from 'estree';
import { unsupported } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type { DynamicElement, Transition } from '../ir/nodes.ts';
import { binding, hasContentBinding } from './bindings.ts';
import { actionCall, attachCall } from './directives.ts';
import { spread, valueOf } from './element.ts';
import { rewrite, runtime } from './script.ts';
import { location } from './meta.ts';
import { cleaned, flush, render, scopeHash, type Emit, type TemplateContext } from './template.ts';
import { transitionCall } from './transitions.ts';

function dynamicNamespace(context: TemplateContext, node: DynamicElement): ES.Expression | null {
	for (const attribute of node.attributes) {
		if (attribute.kind !== 'attribute' || attribute.name !== 'xmlns') continue;
		if (
			attribute.value.kind === 'text' &&
			attribute.value.parts.every((part) => part.kind === 'text')
		)
			return null;
		return b.arrow([], valueOf(context, null, attribute.value));
	}
	return null;
}

export function dynamicCall(
	context: TemplateContext,
	node: DynamicElement,
	anchor: ES.Identifier
): ES.Statement[] {
	const namespace = context.component.namespaces.get(node) ?? 'html';
	const element = b.id(context.names.unique('$$element'));
	const inner = b.id(context.names.unique('$$anchor'));
	const emit: Emit = {
		init: location(context, node, element),
		after: [],
		update: [],
		thunks: [],
		params: []
	};
	const bound: Emit = { init: [], after: [], update: [], thunks: [], params: [] };
	let attributes = scopeHash(context, node) !== null;
	const transitions: Transition[] = [];
	for (const attribute of node.attributes) {
		switch (attribute.kind) {
			case 'transition':
				transitions.push(attribute);
				break;
			case 'action':
				emit.init.push(actionCall(context, element, attribute));
				break;
			case 'attachment':
				emit.init.push(attachCall(context, element, attribute));
				break;
			case 'binding':
				binding(context, node, attribute)(element, attribute.name === 'this' ? emit : bound);
				break;
			case 'attribute':
			case 'spread':
			case 'class':
			case 'style':
				attributes = true;
				break;
			default:
				throw unsupported(attribute, `The ${attribute.kind} directive on <svelte:element>`);
		}
	}
	if (attributes) spread(context, node, element, emit);
	for (const transition of transitions)
		emit.init.push(transitionCall(context, element, transition));
	const childContext = hasContentBinding(node) ? { ...context, boundContent: true } : context;
	const children = render(childContext, cleaned(context, node.body), inner, namespace, false);
	const body = [...flush(context, emit), ...children, ...flush(context, bound)];
	const args: ES.Expression[] = [
		anchor,
		b.arrow([], rewrite(context, node.tag)),
		b.literal(namespace),
		body.length > 0 ? b.arrow([element, inner], body) : b.literal(null)
	];
	const given = dynamicNamespace(context, node);
	if (given !== null) args.push(given);
	return [b.statement(runtime(context, 'element', ...args))];
}
