import type * as ES from 'estree';
import type * as IR from '../../ir/nodes.ts';
import type { Context } from './context.ts';
import { invalidIn, invalidUnder } from './nesting.ts';
import { fail } from './report.ts';
import { typeOf } from './scope.ts';

const illegal = /(^[0-9-.])|[\^$@%&#?!|()[\]{}^*+~;]/;

const react = new Map([
	['className', 'class'],
	['htmlFor', 'for']
]);

const blocks = new Set(['branch', 'keyed-list', 'unkeyed-list', 'async-block', 'keyed-block']);

const opaque = new Set(['component', 'dynamic-element', 'snippet']);

export function eventExpression(attribute: IR.Property): ES.Expression | null {
	return attribute.value.kind === 'expression' ? attribute.value.expression : null;
}

export function globalEvent(context: Context, attribute: IR.Property): void {
	const value = eventExpression(attribute);
	if (
		value?.type === 'Identifier' &&
		value.name === attribute.name &&
		context.scope.get(value.name) === null
	) {
		context.report.warn('attribute_global_event_reference', attribute, { name: attribute.name });
	}
}

function animation(context: Context, attribute: IR.Animation): void {
	const list = context.path.at(-2);
	if (list === undefined || (typeOf(list) !== 'keyed-list' && typeOf(list) !== 'unkeyed-list')) {
		fail('animation_invalid_placement', attribute);
	}
	if (typeOf(list) === 'unkeyed-list') fail('animation_missing_key', attribute);
	const body = (list as IR.KeyedList).body.nodes.filter(
		(node) =>
			node.kind !== 'comment' &&
			node.kind !== 'constant' &&
			node.kind !== 'declaration' &&
			(node.kind !== 'text' || node.data.trim() !== '')
	);
	if (body.length > 1) fail('animation_invalid_placement', attribute);
}

const directions: Readonly<Record<IR.Transition['direction'], string>> = {
	both: 'transition',
	in: 'in',
	out: 'out'
};

export function validateElement(context: Context, node: IR.Element | IR.DynamicElement): void {
	let animated = false;
	let intro: IR.Transition | null = null;
	let outro: IR.Transition | null = null;
	for (const attribute of node.attributes) {
		switch (attribute.kind) {
			case 'attribute': {
				if (illegal.test(attribute.name))
					fail('attribute_invalid_name', attribute, { name: attribute.name });
				if (attribute.name.startsWith('on') && attribute.name.length > 2) {
					if (attribute.value.kind !== 'expression')
						fail('attribute_invalid_event_handler', attribute);
					globalEvent(context, attribute);
				}
				if (attribute.name === 'is') context.report.warn('attribute_avoid_is', attribute);
				const right = react.get(attribute.name);
				if (right !== undefined) {
					context.report.warn('attribute_invalid_property_name', attribute, {
						wrong: attribute.name,
						right
					});
				}
				break;
			}
			case 'animation':
				animation(context, attribute);
				if (animated) fail('animation_duplicate', attribute);
				animated = true;
				break;
			case 'transition': {
				const isIntro = attribute.direction !== 'out';
				const isOutro = attribute.direction !== 'in';
				const existing = (isIntro && intro) || (isOutro && outro) || null;
				if (existing !== null) {
					const a = directions[existing.direction];
					const b = directions[attribute.direction];
					if (a === b) fail('transition_duplicate', attribute, { type: a });
					fail('transition_conflict', attribute, { type: a, existing: b });
				}
				if (isIntro) intro = attribute;
				if (isOutro) outro = attribute;
				break;
			}
			default:
				break;
		}
	}
}

export function placement(context: Context, node: IR.Element): void {
	const parent = context.parentElement;
	if (parent === null) return;
	let past = false;
	let warn = false;
	const ancestors = [parent];
	const report = (message: string): void => {
		if (warn) context.report.warn('node_invalid_placement_ssr', node, { message });
		else fail('node_invalid_placement', node, { message });
	};
	for (let index = context.path.length - 1; index >= 0; index--) {
		const ancestor = context.path[index]!;
		const kind = typeOf(ancestor);
		if (blocks.has(kind)) warn = true;
		if (!past) {
			if (kind === 'element' && (ancestor as IR.Element).name === parent) {
				const message = invalidIn(node.name, parent);
				if (message !== null) report(message);
				past = true;
			}
		} else if (kind === 'element') {
			ancestors.push((ancestor as IR.Element).name);
			const message = invalidUnder(node.name, ancestors);
			if (message !== null) report(message);
		} else if (opaque.has(kind)) {
			break;
		}
	}
}

export function textPlacement(context: Context, node: IR.Text | IR.Expression): void {
	const parent = context.parentElement;
	if (parent === null) return;
	if (node.kind === 'text' && !/[^ \t\r\n]/.test(node.data)) return;
	const message = invalidIn('#text', parent);
	if (message !== null) fail('node_invalid_placement', node, { message });
}

export function lowercaseComponent(context: Context, node: IR.Element): void {
	const binding = context.scope.get(node.name);
	if (binding !== null && binding.declaration === 'import' && binding.references.length === 0) {
		context.report.warn('component_name_lowercase', node, { name: node.name });
	}
}
