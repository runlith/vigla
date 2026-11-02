import type * as ES from 'estree';
import { toClass } from '../../shared/attributes.ts';
import { escapeAttribute } from '../../shared/escape.ts';
import { isProperty, isVoid, propertyName } from '../../shared/html.ts';
import { richSelect, unsupported } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type {
	Attribute,
	ClassToggle,
	DynamicElement,
	Element,
	Namespace,
	Property,
	StyleProperty,
	Value
} from '../ir/nodes.ts';
import { awaiting } from './asynchronous.ts';
import { binding, hasContentBinding } from './bindings.ts';
import { actionCall, attachCall } from './directives.ts';
import { event, handler, isEvent } from './events.ts';
import { rewrite, runtime } from './script.ts';
import { location } from './meta.ts';
import { animationCall, transitionCall } from './transitions.ts';
import { isStatic, staticText, valueOf, valueReactive } from './values.ts';
import {
	cleaned,
	flush,
	HTML_CONTROLLED,
	htmlCall,
	isDynamic,
	memo,
	parts,
	render,
	scopeHash,
	type Emit,
	type Part,
	type TemplateContext
} from './template.ts';

const unsettable = new Set(['autofocus', 'muted', 'defaultValue', 'defaultChecked']);

function update(
	context: TemplateContext,
	node: Element,
	element: ES.Identifier,
	name: string,
	value: ES.Expression,
	attributes: readonly Attribute[]
): ES.Expression {
	const html = (context.component.namespaces.get(node) ?? 'html') === 'html';
	const tag = html ? node.name.toLowerCase() : node.name;
	if (html && name === 'muted')
		return {
			type: 'AssignmentExpression',
			operator: '=',
			left: b.member(element, 'muted'),
			right: value
		};
	if (html && name === 'value') {
		const grouped = attributes.some((other) => other.kind === 'binding' && other.name === 'group');
		if (tag === 'option' || grouped) return runtime(context, 'optionValue', element, value);
		if (tag === 'select') return runtime(context, 'selectValue', element, value);
		return runtime(context, 'value', element, value);
	}
	if (html && name === 'checked') return runtime(context, 'checked', element, value);
	if (html && name === 'selected') return runtime(context, 'selected', element, value);
	if (html && tag === 'select' && name === 'defaultValue')
		return runtime(context, 'selectDefault', element, value);
	if (
		html &&
		name === 'defaultValue' &&
		(attributes.some(
			(other) => other.kind === 'attribute' && other.name === 'value' && isStatic(other.value)
		) ||
			(node.name === 'textarea' && node.body.nodes.length > 0))
	) {
		return runtime(context, 'defaultValue', element, value);
	}
	if (
		html &&
		name === 'defaultChecked' &&
		attributes.some(
			(other) =>
				other.kind === 'attribute' && other.name === 'checked' && other.value.kind === 'boolean'
		)
	) {
		return runtime(context, 'defaultChecked', element, value);
	}
	if (html && isProperty(name)) {
		return {
			type: 'AssignmentExpression',
			operator: '=',
			left: b.member(element, name),
			right: value
		};
	}
	const args: ES.Expression[] = [element, b.literal(name), value];
	if (
		!name.startsWith('xlink') &&
		context.component.ignored.get(node)?.has('hydration_attribute_changed')
	) {
		args.push(b.literal(true));
	}
	return runtime(context, name.startsWith('xlink') ? 'xlink' : 'attr', ...args);
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

function templated(
	context: TemplateContext,
	node: Element | DynamicElement,
	attribute: Property
): boolean {
	return (
		node.kind === 'element' &&
		attribute.name === 'is' &&
		isStatic(attribute.value) &&
		attribute.value.kind === 'text' &&
		(context.component.namespaces.get(node) ?? 'html') === 'html'
	);
}

export function spread(
	context: TemplateContext,
	node: Element | DynamicElement,
	element: ES.Identifier,
	outer: Emit
): void {
	const name = node.kind === 'element' ? node.name : null;
	const emit: Emit = { init: [], after: [], update: [], thunks: [], params: [] };
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
				if (templated(context, node, attribute)) break;
				const value = isEvent(attribute)
					? handler(
							context,
							(attribute.value as { expression: ES.Expression }).expression,
							emit.init
						)
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
			case 'transition':
			case 'animation':
				break;
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
	const unchecked =
		context.component.ignored.get(node)?.has('hydration_attribute_changed') === true;
	if (hash !== null || name === 'input' || unchecked) args.push(b.literal(hash));
	if (name === 'input' || unchecked) args.push(b.literal(name === 'input'));
	if (unchecked) args.push(b.literal(true));
	emit.update.push(
		b.statement({
			type: 'AssignmentExpression',
			operator: '=',
			left: previous,
			right: runtime(context, 'attributes', ...args)
		})
	);
	if (name === 'textarea') {
		outer.init.push(b.statement(runtime(context, 'removeTextareaChild', element)));
	}
	outer.init.push(...flush(context, emit));
	if (
		!node.attributes.some((attribute) => attribute.kind === 'binding' && attribute.name === 'value')
	) {
		outer.init.push(b.statement(runtime(context, 'initSelect', element, b.arrow([], previous))));
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
	const target = reactive ? emit : { init: [], after: [], update: [], thunks: [], params: [] };
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
	const target = reactive ? emit : { init: [], after: [], update: [], thunks: [], params: [] };
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
	const custom =
		node.name.includes('-') ||
		node.attributes.some((attribute) => attribute.kind === 'attribute' && attribute.name === 'is');
	const tag = html && !custom ? node.name.toLowerCase() : node.name;
	let markup = `<${tag}`;
	const setups: ((element: ES.Identifier, emit: Emit) => void)[] = [];
	if (context.dev)
		setups.push((element, emit) => emit.init.push(...location(context, node, element)));
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
		for (const attribute of node.attributes) {
			if (attribute.kind === 'attribute' && templated(context, node, attribute)) {
				markup += ` is="${escapeAttribute(staticText(attribute.value))}"`;
			}
		}
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
				attribute.kind === 'attachment' ||
				attribute.kind === 'transition' ||
				attribute.kind === 'animation'
			) {
				continue;
			}
			if (attribute.kind !== 'attribute') {
				throw unsupported(attribute, `The ${attribute.kind} directive`);
			}
			if (isEvent(attribute)) {
				setups.push((element, emit) =>
					emit.init.push(event(context, element, attribute, emit.init))
				);
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
			if (
				isStatic(attribute.value) &&
				!unsettable.has(name) &&
				!(html && tag === 'select' && name === 'value') &&
				(!custom || templated(context, node, attribute))
			) {
				markup +=
					attribute.value.kind === 'boolean'
						? ` ${lower}=""`
						: ` ${lower}="${escapeAttribute(staticText(attribute.value))}"`;
				continue;
			}
			const reactive = valueReactive(context, attribute.value);
			setups.push((element, emit) => {
				const target = reactive
					? emit
					: { init: [], after: [], update: [], thunks: [], params: [] };
				const value = valueOf(context, target, attribute.value);
				const call = custom
					? runtime(context, 'customProp', element, b.literal(attribute.name), value)
					: update(context, node, element, name, value, node.attributes);
				const afterOptions =
					html && tag === 'select' && (name === 'value' || name === 'defaultValue');
				(reactive ? emit.update : afterOptions ? emit.after : emit.init).push(b.statement(call));
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
			const name = hash === null && classValue?.kind === 'boolean' ? '' : toClass(given, hash);
			if (name !== null) markup += ` class="${escapeAttribute(name)}"`;
		}
		if (styles.length > 0 || styleDynamic) {
			const value = styleValue;
			setups.push((element, emit) => styleAttribute(context, element, value, styles, emit));
		} else if (styleValue !== null) {
			markup +=
				styleValue.kind === 'boolean'
					? ' style=""'
					: ` style="${escapeAttribute(staticText(styleValue))}"`;
		}
	}
	markup += isVoid(tag) ? '/>' : '>';
	const childNamespace = node.name === 'foreignObject' ? 'html' : namespace;
	const body = cleaned(context, node.body);
	const [only] = body;
	const rich = html && richSelect(node);
	const controlled =
		!rich && body.length === 1 && only?.kind === 'raw-html' && awaiting(context, body).length === 0;
	const constantText =
		body.length === 1 &&
		only?.kind === 'expression' &&
		node.name !== 'textarea' &&
		!isDynamic(context, only.expression) &&
		awaiting(context, body).length === 0;
	if (controlled) {
		setups.push((element, emit) =>
			emit.init.push(htmlCall(context, only, element, HTML_CONTROLLED))
		);
	}
	if (constantText) {
		const value = b.logical('??', rewrite(context, only.expression), b.literal(''));
		setups.push((element, emit) =>
			emit.init.push(
				b.statement({
					type: 'AssignmentExpression',
					operator: '=',
					left: b.member(element, 'textContent'),
					right: value
				})
			)
		);
	}
	const childContext = hasContentBinding(node) ? { ...context, boundContent: true } : context;
	const children =
		controlled || constantText || rich ? [] : parts(childContext, body, childNamespace);
	if (rich) {
		markup += '<!---->';
		setups.push((element, emit) => {
			const anchor = b.id(context.names.unique('anchor'));
			const content = render(childContext, body, anchor, childNamespace, false);
			emit.init.push(
				b.statement(runtime(context, 'richSelect', element, b.arrow([anchor], content)))
			);
		});
	}
	for (const child of children) markup += child.html;
	if (!isVoid(tag)) markup += `</${tag}>`;
	for (const attribute of node.attributes) {
		if (attribute.kind === 'transition') {
			setups.push((element, emit) => emit.init.push(transitionCall(context, element, attribute)));
		} else if (attribute.kind === 'animation') {
			setups.push((element, emit) => emit.init.push(animationCall(context, element, attribute)));
		}
	}
	if (
		html &&
		tag === 'select' &&
		!hasSpread &&
		!node.attributes.some(
			(attribute) => attribute.kind === 'binding' && attribute.name === 'value'
		) &&
		node.attributes.some(
			(attribute) =>
				attribute.kind === 'attribute' &&
				['value', 'defaultValue'].includes(propertyName(attribute.name))
		)
	) {
		setups.push((element, emit) =>
			emit.after.push(b.statement(runtime(context, 'initSelect', element)))
		);
	}
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
