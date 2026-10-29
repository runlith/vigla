import type * as ES from 'estree';
import { escapeAttribute, escapeContent } from '../../shared/escape.ts';
import { isBooleanAttribute, isVoid } from '../../shared/html.ts';
import { arm, close, empty, fallback, open, openElse } from '../../shared/markers.ts';
import { unsupported, type ComponentAnalysis } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type {
	Attribute,
	ClassToggle,
	Element,
	Expression,
	Fragment,
	Node,
	StyleProperty,
	Text,
	Value
} from '../ir/nodes.ts';
import type { Host, Scoping } from '../css/index.ts';
import { asyncChild, awaiting } from './asynchronous.ts';
import { bindings, type Bound } from './bindings.ts';
import { boundary, component, render, snippetDeclarations, standalone } from './component.ts';
import { rewrite, runtime, type Context } from './script.ts';

export interface TemplateContext extends Context {
	readonly component: ComponentAnalysis;
	readonly out: ES.Identifier;
	readonly scoping: Scoping;
}

function scopeHash(context: TemplateContext, node: Host): string | null {
	const { hash, scoped } = context.scoping;
	return hash !== '' && scoped.has(node) ? hash : null;
}

export class Buffer {
	#quasis: string[] = [''];
	#values: ES.Expression[] = [];

	text(html: string): void {
		this.#quasis[this.#quasis.length - 1] += html;
	}

	value(expression: ES.Expression): void {
		this.#values.push(expression);
		this.#quasis.push('');
	}

	flush(context: TemplateContext, statements: ES.Statement[]): void {
		if (this.#values.length === 0 && this.#quasis[0] === '') return;
		statements.push(
			b.statement(b.call(b.member(context.out, 'push'), b.template(this.#quasis, this.#values)))
		);
		this.#quasis = [''];
		this.#values = [];
	}
}

function cleaned(context: TemplateContext, fragment: Fragment): readonly Node[] {
	const nodes = context.component.fragments.get(fragment);
	if (nodes === undefined) throw new Error('fragment was not analyzed');
	return nodes;
}

function block(
	context: TemplateContext,
	marker: string,
	fragment: Fragment | null,
	textFirst: boolean
): ES.BlockStatement {
	const statements: ES.Statement[] = [];
	const buffer = new Buffer();
	buffer.text(marker);
	if (fragment !== null)
		fragmentCode(context, cleaned(context, fragment), statements, buffer, textFirst);
	buffer.flush(context, statements);
	return { type: 'BlockStatement', body: statements };
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

function valueOf(context: TemplateContext, value: Value): ES.Expression {
	if (value.kind === 'boolean') return b.literal(true);
	if (value.kind === 'expression') return rewrite(context, value.expression);
	const [only] = value.parts;
	if (value.parts.length === 1 && only?.kind === 'expression') {
		return b.logical('??', rewrite(context, only.expression), b.literal(''));
	}
	const quasis: string[] = [''];
	const expressions: ES.Expression[] = [];
	for (const part of value.parts) {
		if (part.kind === 'text') quasis[quasis.length - 1] += part.data;
		else {
			expressions.push(
				b.logical('??', rewrite(context, (part as Expression).expression), b.literal(''))
			);
			quasis.push('');
		}
	}
	return b.template(quasis, expressions);
}

function property(
	key: string | ES.Expression,
	value: ES.Expression,
	computed = false
): ES.Property {
	return {
		type: 'Property',
		key: typeof key === 'string' ? b.literal(key) : key,
		value,
		kind: 'init',
		method: false,
		shorthand: false,
		computed
	};
}

function directives(
	context: TemplateContext,
	list: readonly (ClassToggle | StyleProperty)[]
): ES.ObjectExpression {
	return {
		type: 'ObjectExpression',
		properties: list.map((directive) =>
			property(
				directive.name,
				directive.kind === 'class'
					? rewrite(context, directive.expression)
					: valueOf(context, directive.value)
			)
		)
	};
}

function styles(context: TemplateContext, list: readonly StyleProperty[]): ES.Expression {
	const normal = list.filter((style) => !style.important);
	const important = list.filter((style) => style.important);
	if (important.length === 0) return directives(context, normal);
	return {
		type: 'ArrayExpression',
		elements: [directives(context, normal), directives(context, important)]
	};
}

function isEvent(attribute: Attribute): boolean {
	return (
		attribute.kind === 'attribute' &&
		attribute.value.kind === 'expression' &&
		/^on/i.test(attribute.name)
	);
}

function ignored(attribute: Attribute): boolean {
	return (
		attribute.kind === 'binding' || attribute.kind === 'action' || attribute.kind === 'attachment'
	);
}

const NAMESPACED = 1;
const PRESERVE_CASE = 2;
const INPUT = 4;

function spreadAttributes(
	context: TemplateContext,
	node: Element,
	html: boolean,
	buffer: Buffer
): void {
	const properties: (ES.Property | ES.SpreadElement)[] = [];
	const toggles: ClassToggle[] = [];
	const list: StyleProperty[] = [];
	for (const attribute of node.attributes) {
		if (attribute.kind === 'spread') {
			properties.push({ type: 'SpreadElement', argument: rewrite(context, attribute.expression) });
		} else if (attribute.kind === 'attribute') {
			if (isEvent(attribute)) continue;
			properties.push(property(attribute.name, valueOf(context, attribute.value)));
		} else if (attribute.kind === 'class') {
			toggles.push(attribute);
		} else if (attribute.kind === 'style') {
			list.push(attribute);
		} else if (!ignored(attribute)) {
			throw unsupported(attribute, `The ${attribute.kind} directive`);
		}
	}
	let flags = 0;
	if (!html) flags |= NAMESPACED | PRESERVE_CASE;
	if (node.name.includes('-')) flags |= PRESERVE_CASE;
	if (node.name === 'input') flags |= INPUT;
	buffer.value(
		runtime(
			context,
			'attributes',
			{ type: 'ObjectExpression', properties },
			b.literal(scopeHash(context, node)),
			toggles.length > 0 ? directives(context, toggles) : b.literal(null),
			list.length > 0 ? styles(context, list) : b.literal(null),
			b.literal(flags)
		)
	);
}

function attributes(context: TemplateContext, node: Element, buffer: Buffer): Bound {
	const html = (context.component.namespaces.get(node) ?? 'html') === 'html';
	const bound = bindings(context, node, buffer);
	if (node.attributes.some((attribute) => attribute.kind === 'spread')) {
		spreadAttributes(context, node, html, buffer);
		return bound;
	}
	let classValue: Value | null = null;
	let styleValue: Value | null = null;
	let content: ES.Expression | null = bound.content;
	const toggles: ClassToggle[] = [];
	const list: StyleProperty[] = [];
	for (const attribute of node.attributes) {
		if (attribute.kind === 'class') {
			toggles.push(attribute);
			continue;
		}
		if (attribute.kind === 'style') {
			list.push(attribute);
			continue;
		}
		if (ignored(attribute)) continue;
		if (attribute.kind !== 'attribute')
			throw unsupported(attribute, `The ${attribute.kind} directive`);
		if (isEvent(attribute)) continue;
		const name = html ? attribute.name.toLowerCase() : attribute.name;
		if (node.name === 'select' && name === 'value' && bound.select !== null) continue;
		if (name === 'class') {
			classValue = attribute.value;
			continue;
		}
		if (name === 'style') {
			styleValue = attribute.value;
			continue;
		}
		if (node.name === 'textarea' && name === 'value') {
			content = valueOf(context, attribute.value);
			continue;
		}
		if (isStatic(attribute.value)) {
			buffer.text(
				attribute.value.kind === 'boolean'
					? ` ${attribute.name}`
					: ` ${attribute.name}="${escapeAttribute(staticText(attribute.value))}"`
			);
			continue;
		}
		const boolean = html && isBooleanAttribute(name);
		buffer.value(
			runtime(
				context,
				'attr',
				b.literal(name),
				valueOf(context, attribute.value),
				...(boolean ? [b.literal(true)] : [])
			)
		);
	}
	const hash = scopeHash(context, node);
	if (toggles.length > 0 || (classValue !== null && !isStatic(classValue))) {
		let value: ES.Expression = classValue === null ? b.literal(null) : valueOf(context, classValue);
		if (classValue?.kind === 'expression') value = runtime(context, 'clsx', value);
		const args: ES.Expression[] = [value];
		if (toggles.length > 0) args.push(b.literal(hash), directives(context, toggles));
		else if (hash !== null) args.push(b.literal(hash));
		buffer.value(runtime(context, 'attrClass', ...args));
	} else {
		const given = classValue === null ? null : staticText(classValue);
		const name = hash === null ? given : given ? `${given} ${hash}` : hash;
		if (name !== null) {
			buffer.text(
				hash === null && classValue?.kind === 'boolean'
					? ' class'
					: ` class="${escapeAttribute(name)}"`
			);
		}
	}
	if (list.length > 0 || (styleValue !== null && !isStatic(styleValue))) {
		const value = styleValue === null ? b.literal(null) : valueOf(context, styleValue);
		const args: ES.Expression[] = [value];
		if (list.length > 0) args.push(styles(context, list));
		buffer.value(runtime(context, 'attrStyle', ...args));
	} else if (styleValue !== null) {
		buffer.text(
			styleValue.kind === 'boolean'
				? ' style'
				: ` style="${escapeAttribute(staticText(styleValue))}"`
		);
	}
	return { ...bound, content };
}

function element(
	context: TemplateContext,
	node: Element,
	statements: ES.Statement[],
	buffer: Buffer
): void {
	buffer.text(`<${node.name}`);
	const { content, raw, select } = attributes(context, node, buffer);
	buffer.text('>');
	if (isVoid(node.name)) return;
	if (content !== null) {
		buffer.value(raw ? runtime(context, 'html', content) : runtime(context, 'escape', content));
	} else if (select !== null) {
		buffer.flush(context, statements);
		statements.push(b.statement(runtime(context, 'pushSelect', select)));
		fragmentCode(context, cleaned(context, node.body), statements, buffer, false, true);
		buffer.flush(context, statements);
		statements.push(b.statement(runtime(context, 'popSelect')));
	} else {
		fragmentCode(context, cleaned(context, node.body), statements, buffer, false, true);
	}
	buffer.text(`</${node.name}>`);
}

export function fragmentCode(
	context: TemplateContext,
	nodes: readonly Node[],
	statements: ES.Statement[],
	buffer: Buffer,
	textFirst: boolean,
	children = false
): void {
	const first = nodes.find((node) => node.kind !== 'snippet');
	if (textFirst && (first?.kind === 'text' || first?.kind === 'expression')) buffer.text(empty);
	statements.push(...snippetDeclarations(context, nodes));
	const alone = !children && standalone(context, nodes);
	let run: Node[] = [];
	const flushRun = (): void => {
		if (run.length === 0) return;
		const group = run;
		run = [];
		const pending = awaiting(context, group);
		if (pending.length > 0) {
			asyncChild(context, group, pending, statements, buffer, fragmentCode);
			return;
		}
		for (const node of group) single(context, node, statements, buffer, alone);
	};
	for (const node of nodes) {
		if (node.kind === 'text' || node.kind === 'expression') {
			run.push(node);
			continue;
		}
		flushRun();
		const pending = node.kind === 'snippet' ? [] : awaiting(context, [node]);
		if (pending.length > 0) {
			asyncChild(context, [node], pending, statements, buffer, fragmentCode);
			continue;
		}
		single(context, node, statements, buffer, alone);
	}
	flushRun();
}

function single(
	context: TemplateContext,
	node: Node,
	statements: ES.Statement[],
	buffer: Buffer,
	alone: boolean
): void {
	{
		switch (node.kind) {
			case 'snippet':
				break;
			case 'component':
				component(context, node, statements, buffer, alone);
				break;
			case 'render':
				render(context, node, statements, buffer, alone);
				break;
			case 'boundary':
				boundary(context, node, statements, buffer);
				break;
			case 'text':
				buffer.text(escapeContent(node.data));
				break;
			case 'comment':
				buffer.text(`<!--${node.data}-->`);
				break;
			case 'expression':
				buffer.value(runtime(context, 'escape', rewrite(context, node.expression)));
				break;
			case 'raw-html':
				buffer.value(runtime(context, 'rawHtml', rewrite(context, node.expression)));
				break;
			case 'element':
				element(context, node, statements, buffer);
				break;
			case 'branch': {
				buffer.flush(context, statements);
				let chain: ES.Statement = block(context, arm(fallback), node.fallback, false);
				for (let index = node.arms.length - 1; index >= 0; index--) {
					const entry = node.arms[index];
					if (entry === undefined) continue;
					chain = {
						type: 'IfStatement',
						test: rewrite(context, entry.test),
						consequent: block(context, arm(index), entry.body, false),
						alternate: chain
					};
				}
				statements.push(chain);
				buffer.text(close);
				break;
			}
			case 'keyed-list':
			case 'unkeyed-list':
				list(context, node, statements, buffer);
				break;
			default:
				throw unsupported(node, `The ${node.kind} node`);
		}
	}
}

function list(
	context: TemplateContext,
	node: Extract<Node, { kind: 'keyed-list' | 'unkeyed-list' }>,
	statements: ES.Statement[],
	buffer: Buffer
): void {
	const facts = context.component.lists.get(node);
	if (facts === undefined) throw new Error('each block was not analyzed');
	buffer.flush(context, statements);
	const items = b.id(context.names.unique('each_array'));
	const index = b.id(facts.index?.name ?? context.names.unique('$$index'));
	const length = b.id(context.names.unique('$$length'));
	statements.push(
		b.constant(items.name, runtime(context, 'iterate', rewrite(context, node.collection)))
	);
	const body = block(context, '', node.body, true);
	const loop: ES.ForStatement = {
		type: 'ForStatement',
		init: {
			type: 'VariableDeclaration',
			kind: 'let',
			declarations: [
				{ type: 'VariableDeclarator', id: index, init: b.literal(0) },
				{ type: 'VariableDeclarator', id: length, init: b.member(items, 'length') }
			]
		},
		test: b.binary('<', index, length),
		update: { type: 'UpdateExpression', operator: '++', prefix: false, argument: index },
		body: {
			type: 'BlockStatement',
			body: [
				{
					type: 'VariableDeclaration',
					kind: 'const',
					declarations: [
						{
							type: 'VariableDeclarator',
							id: b.id(facts.item.name),
							init: {
								type: 'MemberExpression',
								object: items,
								property: index,
								computed: true,
								optional: false
							}
						}
					]
				},
				...body.body
			]
		}
	};
	const push = (html: string): ES.Statement =>
		b.statement(b.call(b.member(context.out, 'push'), b.literal(html)));
	if (node.fallback !== null) {
		statements.push({
			type: 'IfStatement',
			test: b.binary('!==', b.member(items, 'length'), b.literal(0)),
			consequent: { type: 'BlockStatement', body: [push(open), loop] },
			alternate: block(context, openElse, node.fallback, true)
		});
	} else {
		statements.push(push(open), loop);
	}
	buffer.text(close);
}
