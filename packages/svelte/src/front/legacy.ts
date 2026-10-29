import type * as AST from './ast.ts';
import { ignoredCodes } from './ignores.ts';

type Json = Record<string, unknown>;
type Any = { type: string; start: number; end: number; [key: string]: unknown };

const notWhitespace = /[^ \t\r\n]/;
const leadingWhitespace = /^[ \t\r\n]+/;
const trailingWhitespace = /[ \t\r\n]+$/;
const space = /\s/;

const renamed: Readonly<Record<string, string>> = {
	AnimateDirective: 'Animation',
	BindDirective: 'Binding',
	ClassDirective: 'Class',
	HtmlTag: 'RawMustacheTag',
	OnDirective: 'EventHandler',
	SpreadAttribute: 'Spread',
	TransitionDirective: 'Transition',
	UseDirective: 'Action',
	LetDirective: 'Let'
};

const specials: Readonly<Record<string, [string, string]>> = {
	SvelteBody: ['Body', 'svelte:body'],
	SvelteDocument: ['Document', 'svelte:document'],
	SvelteFragment: ['SlotTemplate', 'svelte:fragment'],
	SvelteHead: ['Head', 'svelte:head'],
	SvelteSelf: ['InlineComponent', 'svelte:self'],
	SvelteWindow: ['Window', 'svelte:window']
};

function trimmed(nodes: readonly AST.TemplateNode[]): AST.TemplateNode[] {
	const list = [...nodes];
	const first = list[0];
	if (first?.type === 'Text') {
		if (!notWhitespace.test(first.data)) list.shift();
		else list[0] = { ...first, data: first.data.replace(leadingWhitespace, '') };
	}
	const last = list.at(-1);
	if (last?.type === 'Text') {
		if (!notWhitespace.test(last.data)) list.pop();
		else list[list.length - 1] = { ...last, data: last.data.replace(trailingWhitespace, '') };
	}
	return list;
}

class Converter {
	readonly source: string;

	constructor(source: string) {
		this.source = source;
	}

	nodes(nodes: readonly unknown[], parent: Any): unknown[] {
		return nodes.map((node) => this.node(node as Any, parent));
	}

	attributes(node: AST.ElementLike | AST.Css.StyleSheet): unknown[] {
		return this.nodes(node.attributes, node as unknown as Any);
	}

	element(node: AST.ElementLike, type: string, name: string): Json {
		return {
			type,
			name,
			start: node.start,
			end: node.end,
			attributes: this.attributes(node),
			children: this.nodes(node.fragment.nodes, node as unknown as Any)
		};
	}

	node(node: Any, parent: Any | null): unknown {
		const rename = renamed[node.type];
		if (rename !== undefined) return { ...node, type: rename };
		const special = specials[node.type];
		if (special !== undefined) return this.element(node as unknown as AST.ElementLike, ...special);
		switch (node.type) {
			case 'Text':
				if (parent?.type === 'RegularElement' && parent.name === 'style') {
					return { type: 'Text', start: node.start, end: node.end, data: node.data };
				}
				return node;
			case 'Comment':
				return { ...node, ignores: ignoredCodes(node.data as string) };
			case 'ExpressionTag':
				if (parent?.type === 'Attribute' && this.source[parent.start] === '{') {
					return {
						type: 'AttributeShorthand',
						start: node.start,
						end: node.end,
						expression: node.expression
					};
				}
				return {
					type: 'MustacheTag',
					start: node.start,
					end: node.end,
					expression: node.expression
				};
			case 'Attribute':
			case 'StyleDirective': {
				const value = node.value as AST.AttributeValue;
				if (value === true) return node;
				if (!Array.isArray(value))
					return { ...node, value: [this.node(value as unknown as Any, node)] };
				return { ...node, value: this.nodes(value, node) };
			}
			case 'ConstTag':
				return this.constTag(node as unknown as AST.ConstTag);
			case 'KeyBlock': {
				const block = node as unknown as AST.KeyBlock;
				return {
					type: 'KeyBlock',
					start: block.start,
					end: block.end,
					expression: block.expression,
					children: this.nodes(trimmed(block.fragment.nodes), node)
				};
			}
			case 'EachBlock':
				return this.each(node as unknown as AST.EachBlock);
			case 'IfBlock':
				return this.ifBlock(node as unknown as AST.IfBlock);
			case 'AwaitBlock':
				return this.awaitBlock(node as unknown as AST.AwaitBlock);
			case 'SnippetBlock': {
				const block = node as unknown as AST.SnippetBlock;
				return {
					type: 'SnippetBlock',
					start: block.start,
					end: block.end,
					expression: block.expression,
					parameters: block.parameters,
					children: this.nodes(trimmed(block.body.nodes), node),
					typeParams: block.typeParams
				};
			}
			case 'SvelteBoundary': {
				const element = node as unknown as AST.ElementLike;
				return {
					type: 'SvelteBoundary',
					name: 'svelte:boundary',
					start: element.start,
					end: element.end,
					attributes: this.attributes(element),
					children: this.nodes(trimmed(element.fragment.nodes), node)
				};
			}
			case 'RegularElement': {
				const element = node as unknown as AST.ElementLike;
				return {
					type: 'Element',
					start: element.start,
					end: element.end,
					name: element.name,
					attributes: this.attributes(element),
					children: this.nodes(element.fragment.nodes, node)
				};
			}
			case 'Component': {
				const element = node as unknown as AST.ElementLike;
				return {
					type: 'InlineComponent',
					start: element.start,
					end: element.end,
					name: element.name,
					attributes: this.attributes(element),
					children: this.nodes(element.fragment.nodes, node)
				};
			}
			case 'SvelteComponent': {
				const element = node as unknown as AST.ElementLike;
				return {
					type: 'InlineComponent',
					name: 'svelte:component',
					start: element.start,
					end: element.end,
					expression: element.expression,
					attributes: this.attributes(element),
					children: this.nodes(element.fragment.nodes, node)
				};
			}
			case 'SvelteElement': {
				const element = node as unknown as AST.ElementLike;
				let tag: unknown = element.tag;
				const literal = element.tag as { type: string; value: unknown; start: number };
				if (
					literal.type === 'Literal' &&
					typeof literal.value === 'string' &&
					this.source[literal.start - 1] !== '{'
				) {
					tag = literal.value;
				}
				return {
					type: 'Element',
					name: 'svelte:element',
					start: element.start,
					end: element.end,
					tag,
					attributes: this.attributes(element),
					children: this.nodes(element.fragment.nodes, node)
				};
			}
			case 'SlotElement':
				return this.element(node as unknown as AST.ElementLike, 'Slot', node.name as string);
			case 'TitleElement':
				return this.element(node as unknown as AST.ElementLike, 'Title', 'title');
			case 'SvelteOptions': {
				const element = node as unknown as AST.ElementLike;
				return {
					type: 'Options',
					name: 'svelte:options',
					start: element.start,
					end: element.end,
					attributes: this.attributes(element)
				};
			}
			default:
				return node;
		}
	}

	constTag(node: AST.ConstTag): Json {
		const declarator = node.declaration.declarations[0];
		const { typeAnnotation: _, ...left } = declarator.id as unknown as Json;
		return {
			type: 'ConstTag',
			start: node.start,
			end: node.end,
			expression: {
				type: 'AssignmentExpression',
				start: node.declaration.start + 'const '.length,
				end: node.declaration.end,
				operator: '=',
				left,
				right: declarator.init
			}
		};
	}

	each(node: AST.EachBlock): Json {
		let otherwise: Json | undefined;
		if (node.fallback !== undefined) {
			const end = this.source.lastIndexOf('{', node.end - 1);
			const start = node.fallback.nodes[0]?.start ?? end;
			otherwise = {
				type: 'ElseBlock',
				start,
				end,
				children: this.nodes(trimmed(node.fallback.nodes), node as unknown as Any)
			};
		}
		return {
			type: 'EachBlock',
			start: node.start,
			end: node.end,
			children: this.nodes(trimmed(node.body.nodes), node as unknown as Any),
			context: node.context,
			expression: node.expression,
			index: node.index,
			key: node.key,
			else: otherwise
		};
	}

	ifBlock(node: AST.IfBlock): Json {
		let otherwise: Json | undefined;
		if (node.alternate !== null) {
			let nodes = node.alternate.nodes;
			const only = nodes[0];
			if (nodes.length === 1 && only?.type === 'IfBlock' && only.elseif)
				nodes = only.consequent.nodes;
			const end = this.source.lastIndexOf('{', node.end - 1);
			otherwise = {
				type: 'ElseBlock',
				start: nodes[0]?.start ?? end,
				end,
				children: this.nodes(trimmed(node.alternate.nodes), node as unknown as Any)
			};
		}
		const start = node.elseif
			? (node.consequent.nodes[0]?.start ?? this.source.lastIndexOf('{', node.end - 1))
			: node.start;
		return {
			type: 'IfBlock',
			start,
			end: node.end,
			expression: node.test,
			children: this.nodes(trimmed(node.consequent.nodes), node as unknown as Any),
			else: otherwise,
			elseif: node.elseif ? true : undefined
		};
	}

	awaitBlock(node: AST.AwaitBlock): Json {
		const parent = node as unknown as Any;
		const branch = (type: string, part: AST.Fragment | null) => ({
			type,
			start: null as number | null,
			end: null as number | null,
			children: part === null ? [] : this.nodes(part.nodes, parent),
			skip: true
		});
		const pending = branch('PendingBlock', node.pending);
		const then = branch('ThenBlock', node.then);
		const caught = branch('CatchBlock', node.catch);
		const expressionEnd = node.expression.end as number;
		const afterExpression = this.source.indexOf('}', expressionEnd) + 1;
		if (node.pending !== null) {
			pending.start = node.pending.nodes[0]?.start ?? afterExpression;
			pending.end = node.pending.nodes.at(-1)?.end ?? pending.start;
			pending.skip = false;
		}
		if (node.then !== null) {
			then.start = pending.end ?? node.then.nodes[0]?.start ?? afterExpression;
			then.end =
				node.then.nodes.at(-1)?.end ??
				this.source.lastIndexOf('}', pending.end ?? expressionEnd) + 1;
			then.skip = false;
		}
		if (node.catch !== null) {
			caught.start = then.end ?? pending.end ?? node.catch.nodes[0]?.start ?? afterExpression;
			caught.end =
				node.catch.nodes.at(-1)?.end ??
				this.source.lastIndexOf('}', then.end ?? pending.end ?? expressionEnd) + 1;
			caught.skip = false;
		}
		return {
			type: 'AwaitBlock',
			start: node.start,
			end: node.end,
			expression: node.expression,
			value: node.value,
			error: node.error,
			pending,
			then,
			catch: caught
		};
	}

	css(sheet: AST.Css.StyleSheet): Json {
		return {
			...sheet,
			attributes: this.attributes(sheet),
			children: sheet.children.map((child) => this.cssNode(child)),
			type: 'Style'
		};
	}

	cssNode<T>(node: T): T {
		if (node === null || typeof node !== 'object') return node;
		if (Array.isArray(node)) return node.map((item) => this.cssNode(item)) as T;
		const record = node as unknown as Json;
		if (record.type === 'ComplexSelector') {
			const complex = node as unknown as AST.Css.ComplexSelector;
			const children: unknown[] = [];
			for (const child of complex.children) {
				if (child.combinator !== null) children.push(child.combinator);
				children.push(...child.selectors);
			}
			return { type: 'Selector', start: complex.start, end: complex.end, children } as T;
		}
		if (typeof record.type !== 'string') return node;
		const copy: Json = {};
		for (const key in record) copy[key] = this.cssNode(record[key]);
		return copy as T;
	}
}

export function legacy(source: string, root: AST.Root, options: AST.ElementLike | null): Json {
	const converter = new Converter(source);
	const nodes = [...root.fragment.nodes];
	if (options !== null && root.options !== null) {
		let at = nodes.findIndex((node) => (root.options as AST.SvelteOptions).end <= node.start);
		if (at === -1) at = nodes.length;
		nodes.splice(at, 0, options);
	}
	let start: number | null = null;
	let end: number | null = null;
	if (nodes.length > 0) {
		start = (nodes[0] as AST.TemplateNode).start;
		end = (nodes.at(-1) as AST.TemplateNode).end;
		while (space.test(source[start] ?? '')) start += 1;
		while (space.test(source[end - 1] ?? '')) end -= 1;
	}
	const strip = (script: AST.Script | undefined): Json | undefined => {
		if (script === undefined) return undefined;
		const { attributes: _, ...rest } = script;
		return rest as unknown as Json;
	};
	return {
		html: {
			type: 'Fragment',
			start,
			end,
			children: converter.nodes(nodes, root as unknown as Any)
		},
		instance: strip(root.instance),
		module: strip(root.module),
		css: root.css !== null ? converter.css(root.css) : undefined,
		_comments: root.comments.length > 0 ? root.comments : undefined
	};
}
