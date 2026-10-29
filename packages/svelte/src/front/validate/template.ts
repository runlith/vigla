import type * as AST from '../ast.ts';
import { fail } from '../diagnostics.ts';
import { extractIgnores } from '../ignores.ts';
import { CompileError } from 'vigla/compiler';
import { bidirectionalRun } from '../parse/characters.ts';
import { stopped, type Anchors } from './anchors.ts';
import { isVoid } from '../parse/html.ts';
import type { Report } from './report.ts';

const bidirectional = bidirectionalRun;

const componentAttributes = new Set([
	'Attribute',
	'SpreadAttribute',
	'LetDirective',
	'OnDirective',
	'BindDirective',
	'AttachTag'
]);

const constParents = new Set([
	'IfBlock',
	'SvelteFragment',
	'Component',
	'SvelteComponent',
	'EachBlock',
	'AwaitBlock',
	'SnippetBlock',
	'SvelteBoundary',
	'KeyBlock'
]);

const svgNames = new Set([
	'altGlyph',
	'altGlyphDef',
	'altGlyphItem',
	'animate',
	'animateColor',
	'animateMotion',
	'animateTransform',
	'circle',
	'clipPath',
	'color-profile',
	'cursor',
	'defs',
	'desc',
	'discard',
	'ellipse',
	'feBlend',
	'feColorMatrix',
	'feComponentTransfer',
	'feComposite',
	'feConvolveMatrix',
	'feDiffuseLighting',
	'feDisplacementMap',
	'feDistantLight',
	'feDropShadow',
	'feFlood',
	'feFuncA',
	'feFuncB',
	'feFuncG',
	'feFuncR',
	'feGaussianBlur',
	'feImage',
	'feMerge',
	'feMergeNode',
	'feMorphology',
	'feOffset',
	'fePointLight',
	'feSpecularLighting',
	'feSpotLight',
	'feTile',
	'feTurbulence',
	'filter',
	'font',
	'font-face',
	'font-face-format',
	'font-face-name',
	'font-face-src',
	'font-face-uri',
	'foreignObject',
	'g',
	'glyph',
	'glyphRef',
	'hatch',
	'hatchpath',
	'hkern',
	'image',
	'line',
	'linearGradient',
	'marker',
	'mask',
	'mesh',
	'meshgradient',
	'meshpatch',
	'meshrow',
	'metadata',
	'missing-glyph',
	'mpath',
	'path',
	'pattern',
	'polygon',
	'polyline',
	'radialGradient',
	'rect',
	'set',
	'solidcolor',
	'stop',
	'svg',
	'switch',
	'symbol',
	'text',
	'textPath',
	'tref',
	'tspan',
	'unknown',
	'use',
	'view',
	'vkern'
]);

const mathmlNames = new Set([
	'annotation',
	'annotation-xml',
	'maction',
	'math',
	'merror',
	'mfrac',
	'mi',
	'mmultiscripts',
	'mn',
	'mo',
	'mover',
	'mpadded',
	'mphantom',
	'mprescripts',
	'mroot',
	'mrow',
	'ms',
	'mspace',
	'msqrt',
	'mstyle',
	'msub',
	'msubsup',
	'msup',
	'mtable',
	'mtd',
	'mtext',
	'mtr',
	'munder',
	'munderover',
	'semantics'
]);

type Parent = AST.TemplateNode | AST.Root;

const boundaryAttributes = new Set(['onerror', 'failed', 'pending']);

function isExpressionValue(value: AST.AttributeValue): boolean {
	return (
		value !== true &&
		(!Array.isArray(value) || (value.length === 1 && value[0]?.type === 'ExpressionTag'))
	);
}

function customElement(node: AST.ElementLike): boolean {
	return (
		node.type === 'RegularElement' &&
		(node.name.includes('-') ||
			node.attributes.some(
				(attribute) => attribute.type === 'Attribute' && attribute.name === 'is'
			))
	);
}

export class Template {
	readonly source: string;
	readonly report: Report;
	readonly anchors: Anchors;
	#claimed = 0;

	constructor(source: string, report: Report, anchors: Anchors) {
		this.source = source;
		this.report = report;
		this.anchors = anchors;
	}

	claim(owner: object): void {
		const warnings = this.report.warnings;
		if (this.#claimed === warnings.length) return;
		this.anchors.warn(owner, warnings.slice(this.#claimed));
		this.#claimed = warnings.length;
	}

	walk(root: AST.Root): void {
		try {
			this.fragment(root.fragment, root);
		} catch (error) {
			if (error !== stopped) throw error;
		}
	}

	visit(node: AST.TemplateNode, owner: Parent): void {
		try {
			this.node(node, owner);
		} catch (error) {
			if (error !== stopped) {
				if (!(error instanceof CompileError)) throw error;
				this.claim(node);
				this.anchors.fail(node, error.diagnostic);
			}
			throw stopped;
		}
		this.claim(node);
	}

	fragment(fragment: AST.Fragment | null | undefined, owner: Parent): void {
		if (!fragment) return;
		this.claim(owner);
		const comments: AST.Comment[] = [];
		let bidiIgnored = false;
		for (const node of fragment.nodes) {
			if (node.type === 'Comment') {
				comments.push(node);
				bidiIgnored ||= extractIgnores(node.start + 4, node.data).codes.includes(
					'bidirectional_control_characters'
				);
				continue;
			}
			if (node.type === 'Text') {
				if (!bidiIgnored) this.text(node);
				this.claim(node);
				continue;
			}
			const codes = comments
				.splice(0)
				.flatMap((comment) => extractIgnores(comment.start + 4, comment.data).codes);
			if (codes.length > 0) this.report.push(codes);
			this.visit(node, owner);
			if (codes.length > 0) this.report.pop();
		}
	}

	opening(node: AST.Located, expected: string): void {
		if (this.source[node.start + 1] !== expected) {
			fail(
				'block_unexpected_character',
				{ start: node.start, end: node.start + 5 },
				{ character: expected }
			);
		}
	}

	notEmpty(fragment: AST.Fragment | null | undefined): void {
		const only = fragment?.nodes[0];
		if (fragment?.nodes.length === 1 && only?.type === 'Text' && !only.raw.trim()) {
			this.report.warn('block_empty', only);
		}
	}

	text(node: AST.Text): void {
		for (const match of node.data.matchAll(bidirectional)) {
			const start = match.index + node.start;
			this.report.warn('bidirectional_control_characters', { start, end: start + match[0].length });
		}
	}

	clause(node: AST.Pattern | null, keyword: string): void {
		if (node === null) return;
		const start = node.start as number;
		const match = this.source
			.substring(start - 10, start)
			.match(new RegExp(`{(\\s*):${keyword}\\s+$`));
		if (match && match[1] !== '') {
			fail('block_unexpected_character', { start: start - 10, end: start }, { character: ':' });
		}
	}

	node(node: AST.TemplateNode, parent: Parent): void {
		switch (node.type) {
			case 'IfBlock':
				this.notEmpty(node.consequent);
				this.notEmpty(node.alternate);
				this.opening(node, node.elseif ? ':' : '#');
				this.fragment(node.consequent, node);
				this.fragment(node.alternate, node);
				return;
			case 'EachBlock':
				this.notEmpty(node.body);
				this.notEmpty(node.fallback);
				this.opening(node, '#');
				if (node.key !== undefined && node.context === null) {
					const keyed =
						node.key.type !== 'Identifier' || !node.index || node.key.name !== node.index;
					if (keyed) fail('each_key_without_as', node.key);
				}
				this.fragment(node.body, node);
				this.fragment(node.fallback, node);
				return;
			case 'AwaitBlock':
				this.notEmpty(node.pending);
				this.notEmpty(node.then);
				this.notEmpty(node.catch);
				this.opening(node, '#');
				this.clause(node.value, 'then');
				this.clause(node.error, 'catch');
				this.fragment(node.pending, node);
				this.fragment(node.then, node);
				this.fragment(node.catch, node);
				return;
			case 'KeyBlock':
				this.notEmpty(node.fragment);
				this.opening(node, '#');
				this.fragment(node.fragment, node);
				return;
			case 'SnippetBlock':
				this.notEmpty(node.body);
				this.opening(node, '#');
				for (const parameter of node.parameters) {
					if (parameter.type === 'RestElement') fail('snippet_invalid_rest_parameter', parameter);
				}
				this.fragment(node.body, node);
				return;
			case 'ConstTag':
				this.opening(node, '@');
				this.constTag(node, parent);
				return;
			case 'HtmlTag':
			case 'DebugTag':
				this.opening(node, '@');
				return;
			case 'RenderTag':
				this.opening(node, '@');
				this.renderTag(node);
				return;
			case 'ExpressionTag':
			case 'DeclarationTag':
			case 'Text':
			case 'Comment':
				return;
			default:
				this.element(node);
		}
	}

	constTag(node: AST.ConstTag, parent: Parent): void {
		const allowed =
			constParents.has(parent.type) ||
			((parent.type === 'RegularElement' || parent.type === 'SvelteElement') &&
				parent.attributes.some(
					(attribute) => attribute.type === 'Attribute' && attribute.name === 'slot'
				));
		if (!allowed) fail('const_tag_invalid_placement', node);
	}

	renderTag(node: AST.RenderTag): void {
		const call =
			node.expression.type === 'ChainExpression' ? node.expression.expression : node.expression;
		const callee = (
			call as { callee: { type: string; property?: { type: string; name?: string } } }
		).callee;
		if (
			callee.type === 'MemberExpression' &&
			callee.property?.type === 'Identifier' &&
			['bind', 'apply', 'call'].includes(callee.property.name ?? '')
		) {
			fail('render_tag_invalid_call_expression', node);
		}
	}

	element(node: AST.ElementLike): void {
		switch (node.type) {
			case 'Component':
			case 'SvelteComponent':
			case 'SvelteSelf':
				for (const attribute of node.attributes) {
					if (!componentAttributes.has(attribute.type))
						fail('component_invalid_directive', attribute);
					if (attribute.type === 'Attribute') {
						this.attribute(attribute, node);
						this.colon(attribute);
					} else if (attribute.type === 'BindDirective') {
						this.bindParens(attribute);
					}
				}
				break;
			case 'RegularElement':
			case 'SvelteElement':
				this.elementAttributes(node);
				if (node.type === 'RegularElement') this.regular(node);
				break;
			case 'TitleElement':
				for (const attribute of node.attributes) fail('title_illegal_attribute', attribute);
				for (const child of node.fragment.nodes) {
					if (child.type !== 'Text' && child.type !== 'ExpressionTag')
						fail('title_invalid_content', child);
				}
				break;
			case 'SvelteHead':
				for (const attribute of node.attributes) fail('svelte_head_illegal_attribute', attribute);
				break;
			case 'SvelteBoundary':
				for (const attribute of node.attributes) {
					if (attribute.type !== 'Attribute' || !boundaryAttributes.has(attribute.name)) {
						fail('svelte_boundary_invalid_attribute', attribute);
					}
					const value = attribute.value;
					if (
						value === true ||
						(Array.isArray(value) && (value.length !== 1 || value[0]?.type !== 'ExpressionTag'))
					) {
						fail('svelte_boundary_invalid_attribute_value', attribute);
					}
				}
				break;
			case 'SvelteBody':
				this.childless(node);
				for (const attribute of node.attributes) {
					const event =
						attribute.type === 'Attribute' &&
						attribute.name.startsWith('on') &&
						isExpressionValue(attribute.value);
					if (!event && (attribute.type === 'SpreadAttribute' || attribute.type === 'Attribute')) {
						fail('svelte_body_illegal_attribute', attribute);
					}
				}
				break;
			case 'SvelteWindow':
			case 'SvelteDocument':
				this.childless(node);
				for (const attribute of node.attributes) {
					const event =
						attribute.type === 'Attribute' &&
						attribute.name.startsWith('on') &&
						isExpressionValue(attribute.value);
					if (!event && (attribute.type === 'SpreadAttribute' || attribute.type === 'Attribute')) {
						fail('illegal_element_attribute', attribute, { name: node.name });
					}
				}
				break;
			default:
				break;
		}
		this.fragment(node.fragment, node);
	}

	childless(node: AST.ElementLike): void {
		const nodes = node.fragment.nodes;
		const first = nodes[0];
		const last = nodes.at(-1);
		if (first !== undefined && last !== undefined) {
			fail(
				'svelte_meta_invalid_content',
				{ start: first.start, end: last.end },
				{ name: node.name }
			);
		}
	}

	colon(attribute: AST.Attribute): void {
		const name = attribute.name;
		if (
			name.includes(':') &&
			!name.startsWith('xmlns:') &&
			!name.startsWith('xlink:') &&
			!name.startsWith('xml:')
		) {
			this.report.warn('attribute_illegal_colon', attribute);
		}
	}

	elementAttributes(node: AST.ElementLike): void {
		for (const attribute of node.attributes) {
			if (attribute.type === 'Attribute') {
				this.attribute(attribute, node);
				this.colon(attribute);
			} else if (attribute.type === 'StyleDirective') {
				const modifiers = attribute.modifiers;
				if (modifiers.length > 1 || (modifiers.length > 0 && modifiers[0] !== 'important')) {
					fail('style_directive_invalid_modifier', attribute);
				}
			} else if (attribute.type === 'BindDirective') {
				this.bindParens(attribute);
			}
		}
	}

	bindParens(attribute: AST.Directive): void {
		const expression = attribute.expression;
		if (expression?.type !== 'SequenceExpression') return;
		const comments = (expression as unknown as { leadingComments?: AST.Located[] }).leadingComments;
		const first = comments?.at(0)?.start;
		const last = comments?.at(-1)?.end;
		for (let index = (expression.start as number) - 1; this.source[index] !== '{'; index--) {
			const inComment =
				first !== undefined && last !== undefined && index <= last && index >= first;
			if (this.source[index] === '(' && !inComment) {
				fail('bind_invalid_parens', attribute, { name: attribute.name });
			}
		}
	}

	regular(node: AST.ElementLike): void {
		if (node.name === 'textarea' && node.fragment.nodes.length > 0) {
			for (const attribute of node.attributes) {
				if (attribute.type === 'Attribute' && attribute.name === 'value')
					fail('textarea_invalid_content', node);
			}
		}
		const local = node.name.replace(/[a-zA-Z-]*:/g, '');
		if (
			this.source[node.end - 2] === '/' &&
			!isVoid(local) &&
			!svgNames.has(local) &&
			!mathmlNames.has(local)
		) {
			this.report.warn('element_invalid_self_closing_tag', node, { name: node.name });
		}
	}

	attribute(attribute: AST.Attribute, owner: AST.ElementLike): void {
		const value = attribute.value;
		if (Array.isArray(value)) {
			for (const part of value) if (part.type === 'Text') this.text(part);
		}
		const component =
			owner.type === 'Component' || owner.type === 'SvelteComponent' || owner.type === 'SvelteSelf';
		if (
			Array.isArray(value) &&
			value.length === 1 &&
			value[0]?.type === 'ExpressionTag' &&
			(component || customElement(owner))
		) {
			this.report.warn('attribute_quoted', attribute);
		}
		if (Array.isArray(value) && value.length > 1 && value.at(-1)?.end === attribute.end) {
			fail('attribute_unquoted_sequence', attribute);
		}
		const only = Array.isArray(value) ? (value.length === 1 ? value[0] : undefined) : value;
		if (only === undefined || only === true || only.type !== 'ExpressionTag') return;
		const expression = only.expression;
		if (expression.type !== 'SequenceExpression') return;
		for (let index = (expression.start as number) - 1; index > 0; index--) {
			const char = this.source[index];
			if (char === '(') break;
			if (char === '{') fail('attribute_invalid_sequence_expression', expression);
		}
	}
}
