import type * as ES from 'estree';
import { escapeAttribute } from '../../shared/escape.ts';
import { isCapture, isDelegated, isProperty, isVoid, propertyName } from '../../shared/html.ts';
import { unsupported } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type {
	Attribute,
	ClassToggle,
	DynamicElement,
	Element,
	Expression,
	Namespace,
	Property,
	StyleProperty,
	Text,
	Value
} from '../ir/nodes.ts';
import { awaiting } from './asynchronous.ts';
import { binding } from './bindings.ts';
import { actionCall, attachCall } from './directives.ts';
import { rewrite, runtime } from './script.ts';
import {
	cleaned,
	flush,
	HTML_CONTROLLED,
	htmlCall,
	isDynamic,
	memo,
	parts,
	scopeHash,
	type Emit,
	type Part,
	type TemplateContext
} from './template.ts';

const unsettable = new Set(['autofocus', 'muted', 'defaultValue', 'defaultChecked']);

function isEvent(attribute: Property): boolean {
	return attribute.value.kind === 'expression' && /^on/i.test(attribute.name);
}

function valueReactive(context: TemplateContext, value: Value): boolean {
	if (value.kind === 'boolean') return false;
	if (value.kind === 'expression') return isDynamic(context, value.expression);
	return value.parts.some(
		(part) => part.kind === 'expression' && isDynamic(context, part.expression)
	);
}

function isStatic(value: Value): boolean {
	return (
		value.kind === 'boolean' ||
		(value.kind === 'text' && value.parts.every((part) => part.kind === 'text'))
	);
}

function staticText(value: Value): string {
	return value.kind === 'text' ? value.parts.map((part) => (part as Text).data).join('') : '';
}

export function valueOf(context: TemplateContext, emit: Emit | null, value: Value): ES.Expression {
	if (value.kind === 'boolean') return b.literal(true);
	if (value.kind === 'expression') {
		const rewritten = rewrite(context, value.expression);
		return emit === null ? rewritten : memo(context, emit, value.expression, rewritten);
	}
	const run = value.parts;
	const [only] = run;
	if (run.length === 1 && only?.kind === 'expression') {
		const rewritten = rewrite(context, only.expression);
		const memoized = emit === null ? rewritten : memo(context, emit, only.expression, rewritten);
		return b.logical('??', memoized, b.literal(''));
	}
	const quasis: string[] = [''];
	const expressions: ES.Expression[] = [];
	for (const part of run) {
		if (part.kind === 'text') quasis[quasis.length - 1] += part.data;
		else {
			const rewritten = rewrite(context, (part as Expression).expression);
			const memoized =
				emit === null ? rewritten : memo(context, emit, (part as Expression).expression, rewritten);
			expressions.push(b.logical('??', memoized, b.literal('')));
			quasis.push('');
		}
	}
	return b.template(quasis, expressions);
}

export function handler(context: TemplateContext, expression: ES.Expression): ES.Expression {
	const value = rewrite(context, expression);
	if (value.type === 'ArrowFunctionExpression' || value.type === 'FunctionExpression') return value;
	if (expression.type === 'Identifier') {
		const binding = context.analysis.references.get(expression);
		if (binding !== undefined && context.analysis.functions.has(binding)) return value;
	}
	const args = b.id(context.names.unique('args'));
	const callee: ES.MemberExpression = { ...b.member(value, 'apply'), optional: true };
	return {
		type: 'FunctionExpression',
		id: null,
		params: [{ type: 'RestElement', argument: args }],
		body: {
			type: 'BlockStatement',
			body: [
				b.statement({
					type: 'ChainExpression',
					expression: b.call(callee, { type: 'ThisExpression' }, args)
				})
			]
		},
		async: false,
		generator: false
	};
}

function event(
	context: TemplateContext,
	element: ES.Identifier,
	attribute: Property
): ES.Statement {
	let type = attribute.name.slice(2).toLowerCase();
	const expression = (attribute.value as { expression: ES.Expression }).expression;
	const capture = isCapture(type);
	if (capture) type = type.slice(0, -7);
	const fn = handler(context, expression);
	if (!capture && isDelegated(type)) {
		context.events.add(type);
		return b.statement(runtime(context, 'delegated', element, b.literal(type), fn));
	}
	const args: ES.Expression[] = [element, b.literal(type), fn];
	if (capture) args.push(b.literal(true));
	return b.statement(runtime(context, 'listen', ...args));
}

function update(
	context: TemplateContext,
	node: Element,
	element: ES.Identifier,
	name: string,
	value: ES.Expression,
	attributes: readonly Attribute[]
): ES.Expression {
	if (name === 'muted')
		return {
			type: 'AssignmentExpression',
			operator: '=',
			left: b.member(element, 'muted'),
			right: value
		};
	if (name === 'value') {
		const grouped = attributes.some((other) => other.kind === 'binding' && other.name === 'group');
		if (node.name === 'option' || grouped) return runtime(context, 'optionValue', element, value);
		if (node.name === 'select') return runtime(context, 'selectValue', element, value);
		return runtime(context, 'value', element, value);
	}
	if (name === 'checked') return runtime(context, 'checked', element, value);
	if (name === 'selected') return runtime(context, 'selected', element, value);
	if (
		name === 'defaultValue' &&
		(attributes.some(
			(other) => other.kind === 'attribute' && other.name === 'value' && isStatic(other.value)
		) ||
			(node.name === 'textarea' && node.body.nodes.length > 0))
	) {
		return runtime(context, 'defaultValue', element, value);
	}
	if (
		name === 'defaultChecked' &&
		attributes.some(
			(other) =>
				other.kind === 'attribute' && other.name === 'checked' && other.value.kind === 'boolean'
		)
	) {
		return runtime(context, 'defaultChecked', element, value);
	}
	if (isProperty(name)) {
		return {
			type: 'AssignmentExpression',
			operator: '=',
			left: b.member(element, name),
			right: value
		};
	}
	return runtime(
		context,
		name.startsWith('xlink') ? 'xlink' : 'attr',
		element,
		b.literal(name),
		value
	);
}

function directivesObject(
	context: TemplateContext,
	emit: Emit,
	directives: readonly (ClassToggle | StyleProperty)[]
): ES.ObjectExpression {
	return {
		type: 'ObjectExpression',
		properties: directives.map((directive) => {
			const value =
				directive.kind === 'class'
					? memo(context, emit, directive.expression, rewrite(context, directive.expression))
					: valueOf(context, emit, directive.value);
			return {
				type: 'Property',
				key: b.literal(directive.name),
				value,
				kind: 'init',
				method: false,
				shorthand: false,
				computed: false
			};
		})
	};
}

function styleDirectives(
	context: TemplateContext,
	emit: Emit,
	styles: readonly StyleProperty[]
): ES.Expression {
	const normal = styles.filter((style) => !style.important);
	const important = styles.filter((style) => style.important);
	if (important.length === 0) return directivesObject(context, emit, normal);
	return {
		type: 'ArrayExpression',
		elements: [directivesObject(context, emit, normal), directivesObject(context, emit, important)]
	};
}

export function spread(
	context: TemplateContext,
	node: Element | DynamicElement,
	element: ES.Identifier,
	outer: Emit
): void {
	const name = node.kind === 'element' ? node.name : null;
	const emit: Emit = { init: [], update: [], thunks: [], params: [] };
	const properties: (ES.Property | ES.SpreadElement)[] = [];
	const classes: ClassToggle[] = [];
	const styles: StyleProperty[] = [];
	for (const attribute of node.attributes) {
		switch (attribute.kind) {
			case 'spread':
				properties.push({
					type: 'SpreadElement',
					argument: memo(
						context,
						emit,
						attribute.expression,
						rewrite(context, attribute.expression)
					)
				});
				break;
			case 'attribute': {
				const value = isEvent(attribute)
					? handler(context, (attribute.value as { expression: ES.Expression }).expression)
					: valueOf(context, emit, attribute.value);
				properties.push({
					type: 'Property',
					key: b.literal(attribute.name),
					value,
					kind: 'init',
					method: false,
					shorthand: false,
					computed: false
				});
				break;
			}
			case 'class':
				classes.push(attribute);
				break;
			case 'style':
				styles.push(attribute);
				break;
			case 'binding':
			case 'action':
			case 'attachment':
				break;
			default:
				throw unsupported(attribute, `The ${attribute.kind} directive`);
		}
	}
	if (classes.length > 0) {
		properties.push({
			type: 'Property',
			key: b.member(context.runtime, 'CLASS'),
			value: directivesObject(context, emit, classes),
			kind: 'init',
			method: false,
			shorthand: false,
			computed: true
		});
	}
	if (styles.length > 0) {
		properties.push({
			type: 'Property',
			key: b.member(context.runtime, 'STYLE'),
			value: styleDirectives(context, emit, styles),
			kind: 'init',
			method: false,
			shorthand: false,
			computed: true
		});
	}
	const previous = b.id(context.names.unique('attributes'));
	outer.init.push({
		type: 'VariableDeclaration',
		kind: 'let',
		declarations: [{ type: 'VariableDeclarator', id: previous, init: null }]
	});
	const args: ES.Expression[] = [element, previous, { type: 'ObjectExpression', properties }];
	const hash = scopeHash(context, node);
	if (hash !== null || name === 'input') args.push(b.literal(hash));
	if (name === 'input') args.push(b.literal(true));
	emit.update.push(
		b.statement({
			type: 'AssignmentExpression',
			operator: '=',
			left: previous,
			right: runtime(context, 'attributes', ...args)
		})
	);
	outer.init.push(...flush(context, emit));
	if (name === 'textarea') {
		outer.init.push(b.statement(runtime(context, 'removeTextareaChild', element)));
	}
}

function defaults(
	context: TemplateContext,
	node: Element,
	element: ES.Identifier,
	emit: Emit
): void {
	const named = (names: readonly string[]): Property | undefined =>
		node.attributes.find(
			(attribute): attribute is Property =>
				attribute.kind === 'attribute' && names.includes(attribute.name)
		);
	if (node.name === 'input') {
		if (named(['defaultValue', 'defaultChecked']) !== undefined) return;
		const valued = node.attributes.some(
			(attribute) =>
				(attribute.kind === 'attribute' &&
					(attribute.name === 'value' || attribute.name === 'checked') &&
					attribute.value.kind !== 'text') ||
				(attribute.kind === 'binding' &&
					(attribute.name === 'value' ||
						attribute.name === 'checked' ||
						attribute.name === 'group'))
		);
		if (valued) emit.init.push(b.statement(runtime(context, 'removeInputDefaults', element)));
		return;
	}
	if (node.name === 'textarea') {
		const value = named(['value']);
		const bound = node.attributes.some(
			(attribute) => attribute.kind === 'binding' && attribute.name === 'value'
		);
		if (bound || (value !== undefined && value.value.kind !== 'text')) {
			emit.init.push(b.statement(runtime(context, 'removeTextareaChild', element)));
		}
	}
}

function classAttribute(
	context: TemplateContext,
	node: Element,
	element: ES.Identifier,
	value: Value | null,
	toggles: readonly ClassToggle[],
	namespace: Namespace,
	emit: Emit
): void {
	const reactive =
		(value !== null && valueReactive(context, value)) ||
		toggles.some((toggle) => isDynamic(context, toggle.expression));
	const target = reactive ? emit : { init: [], update: [], thunks: [], params: [] };
	let given: ES.Expression = value === null ? b.literal(null) : valueOf(context, target, value);
	if (value?.kind === 'expression') given = runtime(context, 'clsx', given);
	const args: ES.Expression[] = [
		element,
		b.literal(namespace === 'html' && !node.name.includes('-')),
		given
	];
	const hash = scopeHash(context, node);
	if (toggles.length > 0) {
		const previous = b.id(context.names.unique('classes'));
		emit.init.push({
			type: 'VariableDeclaration',
			kind: 'let',
			declarations: [{ type: 'VariableDeclarator', id: previous, init: null }]
		});
		args.push(b.literal(hash), previous, directivesObject(context, target, toggles));
		const call = {
			type: 'AssignmentExpression',
			operator: '=',
			left: previous,
			right: runtime(context, 'className', ...args)
		} as ES.AssignmentExpression;
		(reactive ? emit.update : emit.init).push(b.statement(call));
		return;
	}
	if (hash !== null) args.push(b.literal(hash));
	(reactive ? emit.update : emit.init).push(b.statement(runtime(context, 'className', ...args)));
}

function styleAttribute(
	context: TemplateContext,
	element: ES.Identifier,
	value: Value | null,
	styles: readonly StyleProperty[],
	emit: Emit
): void {
	const reactive =
		(value !== null && valueReactive(context, value)) ||
		styles.some((style) => valueReactive(context, style.value));
	const target = reactive ? emit : { init: [], update: [], thunks: [], params: [] };
	const given: ES.Expression = value === null ? b.literal(null) : valueOf(context, target, value);
	const args: ES.Expression[] = [element, given];
	if (styles.length > 0) {
		const previous = b.id(context.names.unique('styles'));
		emit.init.push({
			type: 'VariableDeclaration',
			kind: 'let',
			declarations: [{ type: 'VariableDeclarator', id: previous, init: null }]
		});
		args.push(previous, styleDirectives(context, target, styles));
		const call = {
			type: 'AssignmentExpression',
			operator: '=',
			left: previous,
			right: runtime(context, 'style', ...args)
		} as ES.AssignmentExpression;
		(reactive ? emit.update : emit.init).push(b.statement(call));
		return;
	}
	(reactive ? emit.update : emit.init).push(b.statement(runtime(context, 'style', ...args)));
}

export function elementPart(context: TemplateContext, node: Element, parent: Namespace): Part {
	const namespace = context.component.namespaces.get(node) ?? parent;
	const html = namespace === 'html';
	const custom = node.name.includes('-');
	let markup = `<${node.name}`;
	const setups: ((element: ES.Identifier, emit: Emit) => void)[] = [];
	const hasSpread = node.attributes.some((attribute) => attribute.kind === 'spread');
	for (const attribute of node.attributes) {
		if (attribute.kind === 'binding') setups.push(binding(context, node, attribute));
		else if (attribute.kind === 'action') {
			setups.push((element, emit) => emit.init.push(actionCall(context, element, attribute)));
		} else if (attribute.kind === 'attachment') {
			setups.push((element, emit) => emit.init.push(attachCall(context, element, attribute)));
		}
	}
	if (hasSpread) {
		setups.push((element, emit) => spread(context, node, element, emit));
	} else {
		if (node.name === 'input' || node.name === 'textarea') {
			setups.push((element, emit) => defaults(context, node, element, emit));
		}
		let classValue: Value | null = null;
		let styleValue: Value | null = null;
		let classDynamic = false;
		let styleDynamic = false;
		const toggles: ClassToggle[] = [];
		const styles: StyleProperty[] = [];
		for (const attribute of node.attributes) {
			if (attribute.kind === 'class') {
				toggles.push(attribute);
				continue;
			}
			if (attribute.kind === 'style') {
				styles.push(attribute);
				continue;
			}
			if (
				attribute.kind === 'binding' ||
				attribute.kind === 'action' ||
				attribute.kind === 'attachment'
			) {
				continue;
			}
			if (attribute.kind !== 'attribute') {
				throw unsupported(attribute, `The ${attribute.kind} directive`);
			}
			if (isEvent(attribute)) {
				setups.push((element, emit) => emit.init.push(event(context, element, attribute)));
				continue;
			}
			const lower = html ? attribute.name.toLowerCase() : attribute.name;
			if (lower === 'class') {
				classValue = attribute.value;
				classDynamic = !isStatic(attribute.value);
				continue;
			}
			if (lower === 'style') {
				styleValue = attribute.value;
				styleDynamic = !isStatic(attribute.value);
				continue;
			}
			const name = html && !custom ? propertyName(attribute.name) : attribute.name;
			if (isStatic(attribute.value) && !unsettable.has(name) && !custom) {
				markup +=
					attribute.value.kind === 'boolean'
						? ` ${attribute.name}`
						: ` ${attribute.name}="${escapeAttribute(staticText(attribute.value))}"`;
				continue;
			}
			const reactive = valueReactive(context, attribute.value);
			setups.push((element, emit) => {
				const target = reactive ? emit : { init: [], update: [], thunks: [], params: [] };
				const value = valueOf(context, target, attribute.value);
				const call = custom
					? runtime(context, 'customProp', element, b.literal(attribute.name), value)
					: update(context, node, element, name, value, node.attributes);
				(reactive ? emit.update : emit.init).push(b.statement(call));
			});
		}
		if (toggles.length > 0 || classDynamic) {
			const value = classValue;
			setups.push((element, emit) =>
				classAttribute(context, node, element, value, toggles, namespace, emit)
			);
		} else {
			const hash = scopeHash(context, node);
			const given = classValue === null ? null : staticText(classValue);
			const name = hash === null ? given : given ? `${given} ${hash}` : hash;
			if (name !== null) {
				markup +=
					hash === null && classValue?.kind === 'boolean'
						? ' class'
						: ` class="${escapeAttribute(name)}"`;
			}
		}
		if (styles.length > 0 || styleDynamic) {
			const value = styleValue;
			setups.push((element, emit) => styleAttribute(context, element, value, styles, emit));
		} else if (styleValue !== null) {
			markup +=
				styleValue.kind === 'boolean'
					? ' style'
					: ` style="${escapeAttribute(staticText(styleValue))}"`;
		}
	}
	markup += '>';
	const childNamespace = node.name === 'foreignObject' ? 'html' : namespace;
	const body = cleaned(context, node.body);
	const [only] = body;
	const controlled =
		body.length === 1 && only?.kind === 'raw-html' && awaiting(context, body).length === 0;
	if (controlled) {
		setups.push((element, emit) =>
			emit.init.push(htmlCall(context, only, element, HTML_CONTROLLED))
		);
	}
	const children = controlled ? [] : parts(context, body, childNamespace);
	for (const child of children) markup += child.html;
	if (!isVoid(node.name)) markup += `</${node.name}>`;
	return {
		html: markup,
		hint: node.name,
		text: false,
		referenced: setups.length > 0,
		children,
		setup:
			setups.length > 0
				? (element, emit) => {
						for (const setup of setups) setup(element, emit);
					}
				: null
	};
}
