import type * as ES from 'estree';
import { unsupported, type Binding } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type { Binding as BindingNode, DynamicElement, Element, Node } from '../ir/nodes.ts';
import { rewrite, runtime } from './script.ts';
import type { Emit, TemplateContext } from './template.ts';

interface Accessors {
	readonly get: ES.Expression;
	readonly set: ES.Expression;
}

export function accessors(context: TemplateContext, expression: ES.Expression): Accessors {
	if (expression.type === 'SequenceExpression') {
		const [get, set] = expression.expressions as [ES.Expression, ES.Expression];
		return { get: rewrite(context, get), set: rewrite(context, set) };
	}
	const value = b.id(context.names.unique('$$value'));
	const assignment: ES.AssignmentExpression = {
		type: 'AssignmentExpression',
		operator: '=',
		left: expression as ES.Pattern,
		right: value
	};
	return {
		get: b.arrow([], rewrite(context, expression)),
		set: b.arrow([value], rewrite(context, assignment))
	};
}

const sizes = new Set(['clientWidth', 'clientHeight', 'offsetWidth', 'offsetHeight']);

const boxes = new Set([
	'contentRect',
	'contentBoxSize',
	'borderBoxSize',
	'devicePixelContentBoxSize'
]);

const editable = new Set(['innerHTML', 'innerText', 'textContent']);

function source(expression: ES.Node): string {
	const located = expression as ES.Node & { start?: number; end?: number };
	return `${located.start ?? 0}:${located.end ?? 0}`;
}

export type GroupKey = Binding | string;

function group(context: TemplateContext, attribute: BindingNode): ES.Identifier {
	const expression = attribute.expression;
	const key =
		expression.type === 'Identifier'
			? (context.analysis.references.get(expression) ?? `global:${expression.name}`)
			: source(expression);
	let found = context.groups.get(key);
	if (found === undefined) {
		found = b.id(context.names.unique('$$group'));
		context.groups.set(key, found);
		context.instance.push(b.constant(found.name, { type: 'ArrayExpression', elements: [] }));
	}
	return found;
}

export function bindThisCall(
	context: TemplateContext,
	element: ES.Expression,
	expression: ES.Expression
): ES.Expression {
	if (expression.type === 'SequenceExpression') {
		const { get, set } = accessors(context, expression);
		return runtime(context, 'bindThis', element, set, get);
	}
	const parts: ES.Identifier[] = [];
	const plain = new Set(context.plain);
	b.walk(expression, (node) => {
		if (node.type !== 'Identifier') return;
		const binding = context.analysis.references.get(node);
		if (binding === undefined || (binding.kind !== 'item' && binding.kind !== 'index')) return;
		if (!parts.some((part) => part.name === node.name)) parts.push(node);
		plain.add(binding);
	});
	const inner = { ...context, plain };
	const value = b.id(context.names.unique('$$value'));
	const assignment: ES.AssignmentExpression = {
		type: 'AssignmentExpression',
		operator: '=',
		left: expression as ES.Pattern,
		right: value
	};
	const args: ES.Expression[] = [
		element,
		b.arrow([value, ...parts], rewrite(inner, assignment)),
		b.arrow(parts, rewrite(inner, expression))
	];
	if (parts.length > 0) {
		args.push(
			b.arrow([], {
				type: 'ArrayExpression',
				elements: parts.map((part) => rewrite(context, part))
			})
		);
	}
	return runtime(context, 'bindThis', ...args);
}

export function validateBinding(
	context: TemplateContext,
	node: Node,
	attribute: BindingNode
): ES.Statement[] {
	const expression = attribute.expression;
	if (
		!context.dev ||
		expression.type !== 'MemberExpression' ||
		context.externalRows ||
		context.component.ignored.get(node)?.has('binding_property_non_reactive') ||
		(attribute.name === 'this' && node.kind !== 'component' && !context.structural)
	)
		return [];
	let base: ES.Node = expression;
	while (base.type === 'MemberExpression') base = base.object;
	if (base.type === 'Identifier' && context.analysis.externals.has(base)) return [];
	const position = context.positions.at(attribute.start);
	const property = expression.computed
		? rewrite(context, expression.property as ES.Expression)
		: b.literal((expression.property as ES.Identifier).name);
	return [
		b.statement(
			runtime(
				context,
				'validateBinding',
				b.literal(context.component.unit.source.slice(attribute.start, attribute.end)),
				b.arrow([], rewrite(context, expression.object as ES.Expression)),
				b.arrow([], property),
				b.template(['', ':', ':', ''], [position.file!, position.line!, position.column!])
			)
		)
	];
}

export function hasContentBinding(node: Element | DynamicElement): boolean {
	return node.attributes.some(
		(attribute) => attribute.kind === 'binding' && editable.has(attribute.name)
	);
}

export function binding(
	context: TemplateContext,
	node: Element | DynamicElement,
	attribute: BindingNode
): (element: ES.Identifier, emit: Emit) => void {
	const name = attribute.name;
	return (element, emit) => {
		emit.init.push(...validateBinding(context, node, attribute));
		if (name === 'this') {
			emit.init.push(b.statement(bindThisCall(context, element, attribute.expression)));
			return;
		}
		const { get, set } = accessors(context, attribute.expression);
		const call = (fn: string, ...args: ES.Expression[]): void => {
			emit.after.push(b.statement(runtime(context, fn, ...args)));
		};
		if (name === 'value') {
			call(
				node.kind === 'element' && node.name === 'select' ? 'bindSelect' : 'bindValue',
				element,
				get,
				set
			);
		} else if (name === 'checked') {
			call('bindChecked', element, get, set);
		} else if (name === 'indeterminate') {
			call('bindIndeterminate', element, get, set);
		} else if (name === 'group') {
			call('bindGroup', group(context, attribute), element, get, set);
		} else if (name === 'files') {
			call('bindFiles', element, get, set);
		} else if (name === 'currentTime') {
			call('bindCurrentTime', element, get, set);
		} else if (name === 'paused') {
			call('bindPaused', element, get, set);
		} else if (name === 'muted' || name === 'volume' || name === 'playbackRate') {
			call('bindMediaControl', element, b.literal(name), get, set);
		} else if (
			name === 'buffered' ||
			name === 'seekable' ||
			name === 'played' ||
			name === 'duration' ||
			name === 'seeking' ||
			name === 'ended' ||
			name === 'readyState'
		) {
			call('bindMedia', element, b.literal(name), set);
		} else if (name === 'videoWidth' || name === 'videoHeight') {
			call('bindProperty', b.literal(name), b.literal('resize'), element, set);
		} else if (editable.has(name)) {
			call('bindContentEditable', b.literal(name), element, get, set);
		} else if (name === 'open') {
			call('bindProperty', b.literal('open'), b.literal('toggle'), element, set, get);
		} else if (name === 'focused') {
			call('bindFocused', element, set);
		} else if (name === 'naturalWidth' || name === 'naturalHeight') {
			call('bindProperty', b.literal(name), b.literal('load'), element, set);
		} else if (sizes.has(name)) {
			call('bindSize', element, b.literal(name), set);
		} else if (boxes.has(name)) {
			call('bindBox', element, b.literal(name), set);
		} else {
			throw unsupported(attribute, `bind:${name}`);
		}
	};
}
