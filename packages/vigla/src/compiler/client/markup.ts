import type * as ES from 'estree';
import { escapeAttribute, escapeContent } from '../../shared/escape.ts';
import { isVoid } from '../../shared/html.ts';
import * as b from '../ir/estree.ts';
import type { Namespace } from '../ir/nodes.ts';

export type Fragments = 'html' | 'tree';

export interface TextMarkup {
	readonly kind: 'text';
	readonly data: string;
}

export interface CommentMarkup {
	readonly kind: 'comment';
	readonly data: string;
}

export interface ElementMarkup {
	readonly kind: 'element' | 'declaration';
	readonly name: string;
	readonly namespace: Namespace;
	readonly attributes: readonly (readonly [string, string])[];
	readonly children: readonly Markup[];
}

export type Markup = TextMarkup | CommentMarkup | ElementMarkup;

export function elementKind(name: string): ElementMarkup['kind'] {
	return name.startsWith('!') ? 'declaration' : 'element';
}

export const anchorComment: CommentMarkup = { kind: 'comment', data: '' };

export function html(markup: Markup): string {
	switch (markup.kind) {
		case 'text':
			return escapeContent(markup.data);
		case 'comment':
			return `<!--${markup.data}-->`;
		case 'declaration':
		case 'element': {
			let open = `<${markup.name}`;
			for (const [name, value] of markup.attributes) open += ` ${name}="${escapeAttribute(value)}"`;
			if (isVoid(markup.name)) return `${open}/>`;
			return `${open}>${markup.children.map(html).join('')}</${markup.name}>`;
		}
	}
}

function cased(names: string): ReadonlyMap<string, string> {
	return new Map(names.split(' ').map((name) => [name.toLowerCase(), name]));
}

const svgTags = cased(
	'altGlyph altGlyphDef altGlyphItem animateColor animateMotion animateTransform clipPath feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting feDisplacementMap feDistantLight feDropShadow feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur feImage feMerge feMergeNode feMorphology feOffset fePointLight feSpecularLighting feSpotLight feTile feTurbulence foreignObject glyphRef linearGradient radialGradient textPath'
);

const svgAttributes = cased(
	'attributeName attributeType baseFrequency baseProfile calcMode clipPathUnits diffuseConstant edgeMode filterUnits glyphRef gradientTransform gradientUnits kernelMatrix kernelUnitLength keyPoints keySplines keyTimes lengthAdjust limitingConeAngle markerHeight markerUnits markerWidth maskContentUnits maskUnits numOctaves pathLength patternContentUnits patternTransform patternUnits pointsAtX pointsAtY pointsAtZ preserveAlpha preserveAspectRatio primitiveUnits refX refY repeatCount repeatDur requiredExtensions requiredFeatures specularConstant specularExponent spreadMethod startOffset stdDeviation stitchTiles surfaceScale systemLanguage tableValues targetX targetY textLength viewBox viewTarget xChannelSelector yChannelSelector zoomAndPan'
);

const mathmlAttributes = cased('definitionURL');

function parsed(name: string, table: ReadonlyMap<string, string> | null): string {
	const lower = name.toLowerCase();
	return table?.get(lower) ?? lower;
}

const newlineStripping = new Set(['pre', 'textarea', 'listing']);

function treeNodes(nodes: readonly Markup[], parent: string | null): ES.Expression[] {
	const built: ES.Expression[] = [];
	for (const node of nodes) {
		const expression = treeNode(node, built.length === 0, parent);
		if (expression !== null) built.push(expression);
	}
	return built;
}

function treeNode(markup: Markup, first: boolean, parent: string | null): ES.Expression | null {
	switch (markup.kind) {
		case 'declaration':
			return null;
		case 'text':
			return b.literal(
				first && parent !== null && newlineStripping.has(parent)
					? markup.data.replace(/^\r?\n/, '')
					: markup.data
			);
		case 'comment':
			return markup.data === ''
				? b.literal(null)
				: { type: 'ArrayExpression', elements: [b.literal(`// ${markup.data}`)] };
		case 'element': {
			const svg = markup.namespace === 'svg';
			const name = parsed(markup.name, svg ? svgTags : null);
			const attributes = svg
				? svgAttributes
				: markup.namespace === 'mathml'
					? mathmlAttributes
					: null;
			const elements: ES.Expression[] = [b.literal(name)];
			if (markup.attributes.length > 0 || markup.children.length > 0) {
				elements.push(
					markup.attributes.length === 0
						? b.literal(null)
						: b.object(
								Object.fromEntries(
									markup.attributes.map(([key, value]) => [
										parsed(key, attributes),
										b.literal(value)
									])
								)
							)
				);
			}
			elements.push(...treeNodes(markup.children, name));
			return { type: 'ArrayExpression', elements };
		}
	}
}

export function tree(nodes: readonly Markup[]): ES.ArrayExpression {
	return { type: 'ArrayExpression', elements: treeNodes(nodes, null) };
}
