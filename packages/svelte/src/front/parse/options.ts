import type * as ES from 'estree';
import type * as AST from '../ast.ts';
import { fail, type At } from '../diagnostics.ts';

const svgNamespace = 'http://www.w3.org/2000/svg';
const mathmlNamespace = 'http://www.w3.org/1998/Math/MathML';

const tagChar =
	'[a-z0-9_.\xB7\xC0-\xD6\xD8-\xF6\xF8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u{10000}-\u{EFFFF}-]';
const customTag = new RegExp(`^[a-z]${tagChar}*-${tagChar}*$`, 'u');
const reservedTags = new Set([
	'annotation-xml',
	'color-profile',
	'font-face',
	'font-face-src',
	'font-face-uri',
	'font-face-format',
	'font-face-name',
	'missing-glyph'
]);

const propTypes = new Set(['String', 'Number', 'Boolean', 'Array', 'Object']);

type Static = string | number | boolean | RegExp | bigint | null | undefined;

function staticValue(attribute: AST.Attribute): Static {
	const { value } = attribute;
	if (value === true) return true;
	const chunk = Array.isArray(value) ? value[0] : value;
	if (chunk === undefined) return true;
	if (Array.isArray(value) && value.length > 1) return null;
	if (chunk.type === 'Text') return chunk.data;
	if (chunk.expression.type !== 'Literal') return null;
	return chunk.expression.value;
}

function booleanValue(attribute: AST.Attribute): boolean {
	const value = staticValue(attribute);
	if (typeof value !== 'boolean') {
		fail('svelte_options_invalid_attribute_value', attribute, { list: 'true or false' });
	}
	return value;
}

function validateTag(at: At, tag: unknown): asserts tag is string {
	if (typeof tag !== 'string') fail('svelte_options_invalid_tagname', at);
	if (tag) {
		if (!customTag.test(tag)) fail('svelte_options_invalid_tagname', at);
		if (reservedTags.has(tag)) fail('svelte_options_reserved_tagname', at);
	}
}

function plainKey(property: ES.Property | ES.SpreadElement): property is ES.Property & {
	key: ES.Identifier;
} {
	return property.type === 'Property' && !property.computed && property.key.type === 'Identifier';
}

function customElement(attribute: AST.Attribute): AST.CustomElementOptions | undefined {
	const options: AST.CustomElementOptions = {};
	const raw = attribute.value;
	if (raw === true) fail('svelte_options_invalid_customelement', attribute);
	const value = Array.isArray(raw) ? raw : [raw];
	const first = value[0] as AST.Text | AST.ExpressionTag;
	if (first.type === 'Text') {
		const tag = staticValue(attribute);
		validateTag(attribute, tag);
		options.tag = tag;
		return options;
	}
	const expression = first.expression;
	if (expression.type !== 'ObjectExpression') {
		if (expression.type === 'Literal' && expression.value === null) return undefined;
		fail('svelte_options_invalid_customelement', attribute);
	}
	const properties: [string, ES.Node][] = [];
	for (const property of expression.properties) {
		if (!plainKey(property)) fail('svelte_options_invalid_customelement', attribute);
		properties.push([property.key.name, property.value]);
	}
	const find = (name: string): ES.Node | undefined => properties.find(([key]) => key === name)?.[1];

	const tag = properties.find(([name]) => name === 'tag');
	if (tag !== undefined) {
		const tagValue = (tag[1] as ES.Literal | undefined)?.value;
		validateTag(tag as unknown as At, tagValue);
		options.tag = tagValue;
	}

	const props = find('props');
	if (props !== undefined) {
		if (props.type !== 'ObjectExpression')
			fail('svelte_options_invalid_customelement_props', attribute);
		options.props = {};
		for (const property of props.properties) {
			if (!plainKey(property) || property.value.type !== 'ObjectExpression') {
				fail('svelte_options_invalid_customelement_props', attribute);
			}
			const prop: AST.CustomElementProp = {};
			options.props[property.key.name] = prop;
			for (const entry of property.value.properties) {
				if (!plainKey(entry) || entry.value.type !== 'Literal') {
					fail('svelte_options_invalid_customelement_props', attribute);
				}
				const literal = entry.value.value;
				if (entry.key.name === 'type') {
					if (!propTypes.has(literal as string)) {
						fail('svelte_options_invalid_customelement_props', attribute);
					}
					prop.type = literal as AST.CustomElementProp['type'];
				} else if (entry.key.name === 'reflect') {
					if (typeof literal !== 'boolean')
						fail('svelte_options_invalid_customelement_props', attribute);
					prop.reflect = literal;
				} else if (entry.key.name === 'attribute') {
					if (typeof literal !== 'string')
						fail('svelte_options_invalid_customelement_props', attribute);
					prop.attribute = literal;
				} else {
					fail('svelte_options_invalid_customelement_props', attribute);
				}
			}
		}
	}

	const shadow = find('shadow');
	if (shadow) {
		if (shadow.type === 'Literal' && (shadow.value === 'open' || shadow.value === 'none')) {
			options.shadow = shadow.value;
		} else if (shadow.type === 'ObjectExpression') {
			options.shadow = shadow;
		} else {
			fail('svelte_options_invalid_customelement_shadow', attribute);
		}
	}

	const extend = find('extend');
	if (extend) options.extend = extend as AST.Expression;
	return options;
}

export function readOptions(node: AST.ElementLike): AST.SvelteOptions {
	const options: AST.SvelteOptions = {
		start: node.start,
		end: node.end,
		attributes: node.attributes
	};
	for (const attribute of node.attributes) {
		if (attribute.type !== 'Attribute') fail('svelte_options_invalid_attribute', attribute);
		const { name } = attribute;
		switch (name) {
			case 'runes':
				options.runes = booleanValue(attribute);
				break;
			case 'tag':
				fail('svelte_options_deprecated_tag', attribute);
			case 'customElement': {
				const element = customElement(attribute);
				if (element !== undefined) options.customElement = element;
				break;
			}
			case 'namespace': {
				const value = staticValue(attribute);
				if (value === svgNamespace) options.namespace = 'svg';
				else if (value === mathmlNamespace) options.namespace = 'mathml';
				else if (value === 'html' || value === 'mathml' || value === 'svg')
					options.namespace = value;
				else {
					fail('svelte_options_invalid_attribute_value', attribute, {
						list: '"html", "mathml" or "svg"'
					});
				}
				break;
			}
			case 'css': {
				if (staticValue(attribute) === 'injected') options.css = 'injected';
				else fail('svelte_options_invalid_attribute_value', attribute, { list: '"injected"' });
				break;
			}
			case 'immutable':
				options.immutable = booleanValue(attribute);
				break;
			case 'preserveWhitespace':
				options.preserveWhitespace = booleanValue(attribute);
				break;
			case 'accessors':
				options.accessors = booleanValue(attribute);
				break;
			default:
				fail('svelte_options_unknown_attribute', attribute, { name });
		}
	}
	return options;
}
