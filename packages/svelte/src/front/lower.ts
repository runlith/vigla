import type * as ES from 'estree';
import type * as IR from 'dromon/compiler';
import type * as AST from './ast.ts';
import type { Diagnostic } from 'dromon/compiler';
import { unsupported } from './diagnostics.ts';
import { extractIgnores } from './ignores.ts';
import { Resolution } from './runes.ts';
import { stripTypes } from './typescript.ts';

const targets: Readonly<Record<string, IR.Target>> = {
	SvelteHead: 'head',
	SvelteWindow: 'window',
	SvelteDocument: 'document',
	SvelteBody: 'body'
};

const prefixes: Readonly<Record<string, string>> = {
	StyleDirective: 'style',
	BindDirective: 'bind',
	ClassDirective: 'class',
	UseDirective: 'use',
	AnimateDirective: 'animate',
	OnDirective: 'on',
	LetDirective: 'let'
};

function nameStart(attribute: AST.Directive | AST.StyleDirective): number {
	const prefix =
		attribute.type === 'TransitionDirective'
			? attribute.intro && attribute.outro
				? 'transition'
				: attribute.intro
					? 'in'
					: 'out'
			: (prefixes[attribute.type] ?? '');
	return attribute.start + prefix.length + 1;
}

function located<T extends ES.Node>(node: T, start: number, end: number): T {
	return Object.assign(node, { start, end });
}

function chain(name: string, start: number): ES.Expression {
	const parts = name.split('.');
	let offset = start;
	let node: ES.Expression | null = null;
	for (const part of parts) {
		const identifier = located<ES.Identifier>(
			{ type: 'Identifier', name: part },
			offset,
			offset + part.length
		);
		node =
			node === null
				? identifier
				: located<ES.MemberExpression>(
						{
							type: 'MemberExpression',
							object: node,
							property: identifier,
							computed: false,
							optional: false
						},
						start,
						offset + part.length
					);
		offset += part.length + 1;
	}
	return node as ES.Expression;
}

type Commented = ES.Node & { leadingComments?: { value: string; start?: number }[] };

export class Lowering {
	readonly resolution: Resolution;
	readonly ts: boolean;
	readonly ignores = new Map<object, ReadonlySet<string>>();
	readonly warnings: Diagnostic[] = [];

	constructor(ts: boolean) {
		this.ts = ts;
		this.resolution = new Resolution((node) => this.commented(node));
	}

	commented(node: Commented): void {
		const comments = node.leadingComments;
		if (comments === undefined) return;
		const codes: string[] = [];
		for (const comment of comments) {
			const extracted = extractIgnores((comment.start ?? Number.NaN) + 2, comment.value);
			codes.push(...extracted.codes);
			this.warnings.push(...extracted.warnings);
		}
		if (codes.length > 0) this.ignores.set(node, new Set(codes));
	}

	clean<T>(node: T): T {
		return this.ts ? stripTypes(node) : node;
	}

	program(program: ES.Program): ES.Program {
		const cleaned = this.clean(program);
		this.resolution.program(cleaned);
		return cleaned;
	}

	expression<T extends ES.Node>(expression: T): T {
		const cleaned = this.clean(expression);
		this.resolution.expression(cleaned);
		return cleaned;
	}

	pattern<T extends ES.Node>(pattern: T): T {
		const cleaned = this.clean(pattern);
		this.resolution.expression(cleaned);
		return cleaned;
	}

	options(options: AST.SvelteOptions | null): IR.Options | null {
		if (options === null) return null;
		const element = options.customElement;
		let customElement: IR.CustomElement | null = null;
		if (element !== undefined) {
			const shadow = element.shadow;
			customElement = {
				tag: element.tag ?? null,
				shadow:
					shadow === undefined
						? null
						: typeof shadow === 'string'
							? shadow
							: this.expression(shadow),
				props: this.customProps(options),
				extend: element.extend === undefined ? null : this.expression(element.extend)
			};
		}
		return {
			start: options.start,
			end: options.end,
			namespace: options.namespace ?? null,
			css: options.css ?? null,
			customElement,
			preserveWhitespace: options.preserveWhitespace ?? null
		};
	}

	customProps(options: AST.SvelteOptions): ES.ObjectExpression | null {
		for (const attribute of options.attributes) {
			if (attribute.type !== 'Attribute' || attribute.name !== 'customElement') continue;
			const value = attribute.value;
			const tag = Array.isArray(value) ? value[0] : value;
			if (tag === undefined || tag === true || tag.type !== 'ExpressionTag') return null;
			const object = tag.expression;
			if (object.type !== 'ObjectExpression') return null;
			for (const property of object.properties) {
				if (
					property.type === 'Property' &&
					property.key.type === 'Identifier' &&
					property.key.name === 'props' &&
					property.value.type === 'ObjectExpression'
				) {
					return this.expression(property.value);
				}
			}
		}
		return null;
	}

	fragment(fragment: AST.Fragment | null | undefined): IR.Fragment {
		const nodes: IR.Node[] = [];
		const comments: AST.Comment[] = [];
		for (const node of fragment?.nodes ?? []) {
			if (node.type === 'Comment') comments.push(node);
			const lowered = this.node(node);
			if (lowered === null) continue;
			nodes.push(lowered);
			if (node.type === 'Comment' || node.type === 'Text') continue;
			if (comments.length > 0) this.templateIgnores(lowered, comments.splice(0));
		}
		return { nodes };
	}

	templateIgnores(node: IR.Node, comments: readonly AST.Comment[]): void {
		const codes: string[] = [];
		for (let index = comments.length - 1; index >= 0; index--) {
			const comment = comments[index] as AST.Comment;
			const extracted = extractIgnores(comment.start + 4, comment.data);
			codes.push(...extracted.codes);
			this.warnings.push(...extracted.warnings);
		}
		if (codes.length > 0) this.ignores.set(node, new Set(codes));
	}

	part(part: AST.Text | AST.ExpressionTag): IR.Text | IR.Expression {
		return part.type === 'Text'
			? { kind: 'text', start: part.start, end: part.end, data: part.data }
			: {
					kind: 'expression',
					start: part.start,
					end: part.end,
					expression: this.expression(part.expression)
				};
	}

	value(value: AST.AttributeValue): IR.Value {
		if (value === true) return { kind: 'boolean' };
		const only = Array.isArray(value) && value.length === 1 ? value[0] : value;
		if (!Array.isArray(only) && only?.type === 'ExpressionTag') {
			return { kind: 'expression', expression: this.expression(only.expression) };
		}
		const parts = value as (AST.Text | AST.ExpressionTag)[];
		return { kind: 'text', parts: parts.map((part) => this.part(part)) };
	}

	attribute(attribute: AST.AttributeLike): IR.Attribute {
		const span = { start: attribute.start, end: attribute.end };
		switch (attribute.type) {
			case 'Attribute':
				return {
					kind: 'attribute',
					...span,
					name: attribute.name,
					value: this.value(attribute.value)
				};
			case 'SpreadAttribute':
				return { kind: 'spread', ...span, expression: this.expression(attribute.expression) };
			case 'AttachTag':
				return { kind: 'attachment', ...span, expression: this.expression(attribute.expression) };
			case 'StyleDirective':
				return {
					kind: 'style',
					...span,
					name: attribute.name,
					value:
						attribute.value === true
							? {
									kind: 'expression',
									expression: this.expression(chain(attribute.name, nameStart(attribute)))
								}
							: this.value(attribute.value),
					important: attribute.modifiers.includes('important')
				};
			case 'BindDirective':
				return {
					kind: 'binding',
					...span,
					name: attribute.name,
					expression: this.expression(attribute.expression as ES.Expression)
				};
			case 'ClassDirective':
				return {
					kind: 'class',
					...span,
					name: attribute.name,
					expression: this.expression(attribute.expression as ES.Expression)
				};
			case 'UseDirective':
				return {
					kind: 'action',
					...span,
					action: this.expression(chain(attribute.name, nameStart(attribute))),
					argument: attribute.expression === null ? null : this.expression(attribute.expression)
				};
			case 'TransitionDirective':
				return {
					kind: 'transition',
					...span,
					direction: attribute.intro && attribute.outro ? 'both' : attribute.intro ? 'in' : 'out',
					transition: this.expression(chain(attribute.name, nameStart(attribute))),
					argument: attribute.expression === null ? null : this.expression(attribute.expression),
					global: attribute.modifiers.includes('global')
				};
			case 'AnimateDirective':
				return {
					kind: 'animation',
					...span,
					animation: this.expression(chain(attribute.name, nameStart(attribute))),
					argument: attribute.expression === null ? null : this.expression(attribute.expression)
				};
			case 'OnDirective':
			case 'LetDirective':
				unsupported(`The ${attribute.type}`, attribute);
		}
	}

	attributes(node: AST.ElementLike): IR.Attribute[] {
		return node.attributes.map((attribute) => this.attribute(attribute));
	}

	branch(block: AST.IfBlock): IR.Branch {
		const arms: IR.Arm[] = [];
		let current = block;
		let fallback: IR.Fragment | null = null;
		for (;;) {
			arms.push({
				start: current.start,
				end: current.end,
				test: this.expression(current.test),
				body: this.fragment(current.consequent)
			});
			const alternate = current.alternate;
			const only = alternate?.nodes[0];
			if (
				alternate !== null &&
				alternate.nodes.length === 1 &&
				only?.type === 'IfBlock' &&
				only.elseif
			) {
				current = only;
				continue;
			}
			fallback = alternate === null ? null : this.fragment(alternate);
			break;
		}
		return { kind: 'branch', start: block.start, end: block.end, arms, fallback };
	}

	each(node: AST.EachBlock): IR.KeyedList | IR.UnkeyedList {
		const list = {
			start: node.start,
			end: node.end,
			collection: this.expression(node.expression),
			item: node.context === null ? null : this.pattern(node.context),
			index:
				node.index === undefined
					? null
					: ({ type: 'Identifier', name: node.index } as ES.Identifier),
			body: this.fragment(node.body),
			fallback: node.fallback === undefined ? null : this.fragment(node.fallback)
		};
		return node.key === undefined
			? { kind: 'unkeyed-list', ...list }
			: { kind: 'keyed-list', ...list, key: this.expression(node.key) };
	}

	element(node: AST.ElementLike): IR.Node | null {
		const span = { start: node.start, end: node.end };
		switch (node.type) {
			case 'RegularElement':
				return {
					kind: 'element',
					...span,
					name: node.name,
					attributes: this.attributes(node),
					body: this.fragment(node.fragment)
				};
			case 'Component':
				return {
					kind: 'component',
					...span,
					reference: this.expression(chain(node.name, node.start + 1)),
					attributes: this.attributes(node),
					body: this.fragment(node.fragment)
				};
			case 'TitleElement':
				return {
					kind: 'title',
					...span,
					parts: node.fragment.nodes
						.filter(
							(child): child is AST.Text | AST.ExpressionTag =>
								child.type === 'Text' || child.type === 'ExpressionTag'
						)
						.map((child) => this.part(child))
				};
			case 'SvelteHead':
			case 'SvelteWindow':
			case 'SvelteDocument':
			case 'SvelteBody':
				return {
					kind: 'special',
					...span,
					target: targets[node.type] as IR.Target,
					attributes: this.attributes(node),
					body: this.fragment(node.fragment)
				};
			case 'SvelteElement':
				return {
					kind: 'dynamic-element',
					...span,
					tag: this.expression(node.tag as ES.Expression),
					namespace: null,
					attributes: this.attributes(node),
					body: this.fragment(node.fragment)
				};
			case 'SvelteBoundary':
				return {
					kind: 'boundary',
					...span,
					attributes: this.attributes(node),
					body: this.fragment(node.fragment)
				};
			case 'SlotElement': {
				const name = node.attributes.find(
					(attribute): attribute is AST.Attribute =>
						attribute.type === 'Attribute' && attribute.name === 'name'
				);
				const value = name?.value;
				const text =
					Array.isArray(value) && value.length === 1 && value[0]?.type === 'Text'
						? value[0].data
						: null;
				return {
					kind: 'slot',
					...span,
					name: text,
					attributes: this.attributes(node),
					fallback: this.fragment(node.fragment)
				};
			}
			case 'SvelteOptions':
				return null;
			case 'SvelteComponent':
			case 'SvelteSelf':
			case 'SvelteFragment':
				unsupported(`<${node.name}>`, node);
		}
	}

	node(node: AST.TemplateNode): IR.Node | null {
		const span = { start: node.start, end: node.end };
		switch (node.type) {
			case 'Text':
			case 'ExpressionTag':
				return this.part(node);
			case 'Comment':
				return { kind: 'comment', ...span, data: node.data };
			case 'HtmlTag':
				return { kind: 'raw-html', ...span, expression: this.expression(node.expression) };
			case 'ConstTag': {
				const declaration = this.clean(node.declaration);
				this.resolution.expression(declaration);
				return {
					kind: 'constant',
					...span,
					declarator: declaration.declarations[0] as ES.VariableDeclarator
				};
			}
			case 'DebugTag':
				return {
					kind: 'debug',
					...span,
					identifiers: node.identifiers.map((identifier) => this.expression(identifier))
				};
			case 'RenderTag':
				return { kind: 'render', ...span, call: this.expression(node.expression) };
			case 'DeclarationTag':
				unsupported('A declaration tag', node);
			case 'IfBlock':
				return this.branch(node);
			case 'EachBlock':
				return this.each(node);
			case 'AwaitBlock':
				return {
					kind: 'async-block',
					...span,
					promise: this.expression(node.expression),
					pending: node.pending === null ? null : this.fragment(node.pending),
					resolved:
						node.then === null
							? null
							: {
									binding: node.value === null ? null : this.pattern(node.value),
									body: this.fragment(node.then)
								},
					rejected:
						node.catch === null
							? null
							: {
									binding: node.error === null ? null : this.pattern(node.error),
									body: this.fragment(node.catch)
								}
				};
			case 'KeyBlock':
				return {
					kind: 'keyed-block',
					...span,
					key: this.expression(node.expression),
					body: this.fragment(node.fragment)
				};
			case 'SnippetBlock':
				return {
					kind: 'snippet',
					...span,
					name: node.expression,
					parameters: node.parameters.map((parameter) => this.pattern(parameter)),
					body: this.fragment(node.body)
				};
			default:
				return this.element(node);
		}
	}
}
