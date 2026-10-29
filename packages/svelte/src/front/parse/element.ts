import type * as AST from '../ast.ts';
import { fail } from '../diagnostics.ts';
import {
	attributeExpression,
	isExpressionAttribute,
	readAttribute,
	readSequence,
	readStaticAttribute,
	readTag,
	readTagName
} from './attribute.ts';
import { closingTagOmitted, isVoid, validComponentName, validElementName } from './html.ts';
import { fragment, type Open, type Parser } from './parser.ts';
import { readScript } from './script.ts';
import { readStyle } from './style.ts';

const textareaEnd = /<\/textarea(\s[^>]*)?>/iy;

const rootOnly = new Map<string, AST.ElementType>([
	['svelte:head', 'SvelteHead'],
	['svelte:options', 'SvelteOptions'],
	['svelte:window', 'SvelteWindow'],
	['svelte:document', 'SvelteDocument'],
	['svelte:body', 'SvelteBody']
]);

const metaTags = new Map<string, AST.ElementType>([
	...rootOnly,
	['svelte:element', 'SvelteElement'],
	['svelte:component', 'SvelteComponent'],
	['svelte:self', 'SvelteSelf'],
	['svelte:fragment', 'SvelteFragment'],
	['svelte:boundary', 'SvelteBoundary']
]);

const metaList = (() => {
	const names = [...metaTags.keys()];
	return `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`;
})();

const elementNodes = new Set([
	'SvelteElement',
	'RegularElement',
	'SvelteFragment',
	'Component',
	'SvelteComponent',
	'SvelteSelf',
	'SlotElement'
]);

function isElement(node: Open): node is AST.ElementLike {
	return elementNodes.has(node.type);
}

export function element(parser: Parser): void {
	const start = parser.index++;
	const parent = parser.current();

	if (parser.eat('!--')) {
		const data = parser.readUntil('-->');
		parser.eat('-->', true);
		parser.append({ type: 'Comment', start, end: parser.index, data });
		return;
	}

	if (parser.eat('/')) {
		closeElement(parser, start, parent);
		return;
	}

	const tag = readTag(parser);
	if (tag.name.startsWith('svelte:') && !metaTags.has(tag.name)) {
		fail(
			'svelte_meta_invalid_tag',
			{ start: start + 1, end: start + 1 + tag.name.length },
			{ list: metaList }
		);
	}
	if (!validElementName(tag.name) && !validComponentName.test(tag.name)) {
		if (!parser.loose || !tag.name.endsWith('.')) {
			fail('tag_invalid_name', { start: start + 1, end: start + 1 + tag.name.length });
		}
	}
	if (rootOnly.has(tag.name)) {
		if (parser.meta.has(tag.name)) fail('svelte_meta_duplicate', start, { name: tag.name });
		if (parent.type !== 'Root') fail('svelte_meta_invalid_placement', start, { name: tag.name });
		parser.meta.add(tag.name);
	}

	const type: AST.ElementType =
		metaTags.get(tag.name) ??
		(validComponentName.test(tag.name) || (parser.loose && tag.name.endsWith('.'))
			? 'Component'
			: tag.name === 'title' && insideHead(parser.stack)
				? 'TitleElement'
				: tag.name === 'slot' && !insideShadowRoot(parser.stack)
					? 'SlotElement'
					: 'RegularElement');

	const node: AST.ElementLike = {
		type,
		start,
		end: -1,
		name: tag.name,
		name_loc: tag.loc,
		attributes: [],
		fragment: fragment()
	};

	parser.allowWhitespace();

	if (parent.type === 'RegularElement' && closingTagOmitted(parent.name, tag.name)) {
		const end = parent.fragment.nodes[0]?.start ?? start;
		parser.warn(
			'element_implicitly_closed',
			{ start: parent.start, end },
			{ tag: `<${tag.name}>`, closing: `</${parent.name}>` }
		);
		parent.end = start;
		parser.pop();
		parser.lastAutoClosed = { tag: parent.name, reason: tag.name, depth: parser.stack.length };
	}

	const current = parser.current();
	const topLevel = (tag.name === 'script' || tag.name === 'style') && current.type === 'Root';
	readAttributes(parser, node, topLevel);
	thisAttribute(parser, node, start);

	if (topLevel) {
		parser.eat('>', true);
		topLevelContent(parser, current as AST.Root, node, start);
		return;
	}

	parser.append(node);
	content(parser, node);
}

function readAttributes(parser: Parser, node: AST.ElementLike, topLevel: boolean): void {
	const unique = new Set<string>();
	for (;;) {
		const attribute = topLevel ? readStaticAttribute(parser) : readAttribute(parser);
		if (attribute === null) return;
		if (
			attribute.type === 'Attribute' ||
			attribute.type === 'BindDirective' ||
			attribute.type === 'StyleDirective' ||
			attribute.type === 'ClassDirective'
		) {
			const kind = attribute.type === 'BindDirective' ? 'Attribute' : attribute.type;
			const key = `${kind}${attribute.name}`;
			if (unique.has(key)) fail('attribute_duplicate', attribute);
			else if (attribute.name !== 'this') unique.add(key);
		}
		node.attributes.push(attribute);
		parser.allowWhitespace();
	}
}

function takeThis(node: AST.ElementLike): AST.Attribute | null {
	const index = node.attributes.findIndex(
		(attribute) => attribute.type === 'Attribute' && attribute.name === 'this'
	);
	return index === -1 ? null : (node.attributes.splice(index, 1)[0] as AST.Attribute);
}

function thisAttribute(parser: Parser, node: AST.ElementLike, start: number): void {
	if (node.type === 'SvelteComponent') {
		const definition = takeThis(node);
		if (definition === null) fail('svelte_component_missing_this', start);
		if (!isExpressionAttribute(definition)) fail('svelte_component_invalid_this', definition.start);
		node.expression = attributeExpression(definition);
	}
	if (node.type === 'SvelteElement') {
		const definition = takeThis(node);
		if (definition === null) fail('svelte_element_missing_this', start);
		if (definition.value === true) fail('svelte_element_missing_this', definition);
		if (isExpressionAttribute(definition)) {
			node.tag = attributeExpression(definition);
			return;
		}
		parser.warn('svelte_element_invalid_this', definition);
		const chunk = (definition.value as (AST.Text | AST.ExpressionTag)[])[0] as
			| AST.Text
			| AST.ExpressionTag;
		node.tag =
			chunk.type === 'Text'
				? ({
						type: 'Literal',
						value: chunk.data,
						raw: `'${chunk.raw}'`,
						start: chunk.start,
						end: chunk.end
					} as AST.Expression)
				: chunk.expression;
	}
}

function topLevelContent(
	parser: Parser,
	root: AST.Root,
	node: AST.ElementLike,
	start: number
): void {
	const comment = precedingComment(root, start);
	if (node.name === 'script') {
		const script = readScript(parser, start, node.attributes);
		if (comment !== null) {
			(script.content as unknown as { leadingComments: unknown[] }).leadingComments = [
				{ type: 'Line', value: comment.data }
			];
		}
		if (script.context === 'module') {
			if (root.module !== undefined) fail('script_duplicate', start);
			root.module = script;
		} else {
			if (root.instance !== undefined) fail('script_duplicate', start);
			root.instance = script;
		}
		return;
	}
	const style = readStyle(parser, start, node.attributes);
	style.content.comment = comment;
	if (root.css !== null) fail('style_duplicate', start);
	root.css = style;
}

function content(parser: Parser, node: AST.ElementLike): void {
	const selfClosing = parser.eat('/') || isVoid(node.name);
	const closed = parser.eat('>', true, false);

	if (!closed) {
		const last = node.attributes.at(-1);
		if (last?.type === 'Attribute' && last.name === '<') {
			parser.index = last.start;
			node.attributes.pop();
		} else {
			const before = parser.template[parser.index - 1];
			const twoBefore = parser.template[parser.index - 2];
			const here = parser.template[parser.index];
			if (twoBefore === '{' && before === '/') parser.index -= 2;
			else if (before === '{' && (here === '#' || here === '@' || here === ':')) parser.index -= 1;
			else parser.allowWhitespace();
		}
	}

	if (selfClosing || !closed) {
		node.end = parser.index;
	} else if (node.name === 'textarea') {
		node.fragment.nodes = readSequence(
			parser,
			() => {
				textareaEnd.lastIndex = parser.index;
				return textareaEnd.test(parser.template);
			},
			'inside <textarea>'
		);
		parser.read(textareaEnd);
		node.end = parser.index;
	} else if (node.name === 'script' || node.name === 'style') {
		const from = parser.index;
		const closing = `</${node.name}>`;
		const found = parser.template.indexOf(closing, parser.index);
		const to = found === -1 ? parser.template.length : found;
		const data = parser.template.slice(from, to);
		parser.index = to;
		node.fragment.nodes.push({ start: from, end: to, type: 'Text', data, raw: data });
		parser.eat(closing, true);
		node.end = parser.index;
	} else {
		parser.push(node, node.fragment);
	}
}

function closeElement(parser: Parser, start: number, from: Open): void {
	let parent = from;
	const name = readTagName(parser);
	parser.allowWhitespace();
	parser.eat('>', true);
	if (isVoid(name)) fail('void_element_invalid_content', start);

	while ((parent as AST.ElementLike).name !== name) {
		if (parser.loose && isElement(parent)) {
			const last = parent.attributes.at(-1);
			if (last?.type === 'Attribute' && last.name === `<${name}`) {
				parser.index = last.start;
				parent.attributes.pop();
				break;
			}
		}
		if (parent.type === 'RegularElement') {
			if (parser.lastAutoClosed === undefined || parser.lastAutoClosed.tag !== name) {
				const end = parent.fragment.nodes[0]?.start ?? start;
				parser.warn(
					'element_implicitly_closed',
					{ start: parent.start, end },
					{ tag: `</${name}>`, closing: `</${parent.name}>` }
				);
			}
		} else if (!parser.loose) {
			if (parser.lastAutoClosed !== undefined && parser.lastAutoClosed.tag === name) {
				fail('element_invalid_closing_tag_autoclosed', start, {
					name,
					reason: parser.lastAutoClosed.reason
				});
			}
			fail('element_invalid_closing_tag', start, { name });
		}
		parent.end = start;
		parser.pop();
		parent = parser.current();
	}

	parent.end = parser.index;
	parser.pop();
	if (parser.lastAutoClosed !== undefined && parser.stack.length < parser.lastAutoClosed.depth) {
		parser.lastAutoClosed = undefined;
	}
}

function precedingComment(root: AST.Root, start: number): AST.Comment | null {
	const nodes = root.fragment.nodes;
	for (let index = nodes.length - 1; index >= 0; index--) {
		const node = nodes[index] as AST.TemplateNode;
		if (index === nodes.length - 1 && node.end !== start) return null;
		if (node.type === 'Comment') return node;
		if (node.type !== 'Text' || node.data.trim()) return null;
	}
	return null;
}

function insideHead(stack: readonly Open[]): boolean {
	for (let index = stack.length - 1; index >= 0; index--) {
		const type = (stack[index] as Open).type;
		if (type === 'SvelteHead') return true;
		if (type === 'RegularElement' || type === 'Component') return false;
	}
	return false;
}

function insideShadowRoot(stack: readonly Open[]): boolean {
	for (let index = stack.length - 1; index >= 0; index--) {
		const node = stack[index] as Open;
		if (
			node.type === 'RegularElement' &&
			node.attributes.some(
				(attribute) => attribute.type === 'Attribute' && attribute.name === 'shadowrootmode'
			)
		) {
			return true;
		}
	}
	return false;
}
