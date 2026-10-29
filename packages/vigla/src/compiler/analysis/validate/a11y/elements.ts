import type { DynamicElement, Element, Fragment, Node } from '../../../ir/nodes.ts';
import type { Pass } from './attributes.ts';
import { parentIs, staticText, staticValue, type Facts } from './facts.ts';
import {
	addressTypeTokens,
	autofillContactFieldNameTokens,
	autofillFieldNameTokens,
	contactTypeTokens,
	distractingElements,
	headings,
	labelable,
	requiredAttributes
} from './tables.ts';

const javascriptUrl = /^\W*javascript:/i;
const redundantAlt = /\b(image|picture|photo)\b/i;
const notWhitespace = /[^ \t\r\n]/;
const whitespace = /\s+/;

function children(node: Node): readonly Fragment[] {
	switch (node.kind) {
		case 'element':
		case 'component':
		case 'dynamic-element':
		case 'keyed-block':
		case 'boundary':
		case 'snippet':
		case 'special':
			return [node.body];
		case 'branch':
			return [...node.arms.map((arm) => arm.body), ...(node.fallback ? [node.fallback] : [])];
		case 'keyed-list':
		case 'unkeyed-list':
			return node.fallback ? [node.body, node.fallback] : [node.body];
		case 'async-block':
			return [node.pending, node.resolved?.body, node.rejected?.body].filter(
				(fragment): fragment is Fragment => fragment != null
			);
		case 'slot':
			return [node.fallback];
		default:
			return [];
	}
}

function hasAttribute(element: Element | DynamicElement, name: string): boolean {
	return element.attributes.some(
		(attribute) => attribute.kind === 'attribute' && attribute.name === name
	);
}

function hasContent(element: Element | DynamicElement): boolean {
	for (const node of element.body.nodes) {
		if (node.kind === 'text' && node.data.trim() === '') continue;
		if (node.kind === 'element' || node.kind === 'dynamic-element') {
			if (hasAttribute(node, 'popover')) continue;
			if (node.kind === 'element' && node.name === 'img' && hasAttribute(node, 'alt')) return true;
			if (node.kind === 'element' && node.name === 'selectedcontent') return true;
			if (!hasContent(node)) continue;
		}
		return true;
	}
	return false;
}

function hasControl(fragment: Fragment): boolean {
	const pending: Fragment[] = [fragment];
	for (let current = pending.pop(); current !== undefined; current = pending.pop()) {
		for (const node of current.nodes) {
			switch (node.kind) {
				case 'dynamic-element':
				case 'slot':
				case 'component':
				case 'render':
					return true;
				case 'element':
					if (labelable.has(node.name) || node.name === 'slot') return true;
			}
			pending.push(...children(node));
		}
	}
	return false;
}

function validAutocomplete(value: string | true | null): boolean {
	if (value === true) return false;
	if (!value) return true;
	const tokens = value.trim().toLowerCase().split(whitespace);
	let at = 0;
	if (tokens[at]?.startsWith('section-')) at++;
	if (addressTypeTokens.has(tokens[at] as string)) at++;
	if (autofillFieldNameTokens.has(tokens[at] as string)) {
		at++;
	} else {
		if (contactTypeTokens.has(tokens[at] as string)) at++;
		if (!autofillContactFieldNameTokens.has(tokens[at] as string)) return false;
		at++;
	}
	if (tokens[at] === 'webauthn') at++;
	return at >= tokens.length;
}

function missing(pass: Pass, attributes: readonly string[], name = pass.facts.name): void {
	const first = attributes[0] as string;
	const article = /^[aeiou]/.test(first) || first === 'href' ? 'an' : 'a';
	const sequence =
		attributes.length > 1 ? `${attributes.slice(0, -1).join(', ')} or ${attributes.at(-1)}` : first;
	pass.report.warn('a11y_missing_attribute', pass.facts.element, { name, article, sequence });
}

function labelled(facts: Facts): boolean {
	return facts.map.has('aria-label') || facts.map.has('aria-labelledby') || facts.map.has('title');
}

function checkLink(pass: Pass): void {
	const { facts, report } = pass;
	const { element, map } = facts;
	const hidden =
		staticValue(map.get('aria-hidden')) === 'true' || staticValue(map.get('inert')) !== null;
	if (!facts.spread && !hidden && !labelled(facts) && !hasContent(element)) {
		report.warn('a11y_consider_explicit_label', element);
	}
	if (facts.name === 'button') return;
	const href = map.get('href') || map.get('xlink:href');
	if (href) {
		const value = staticText(href);
		if (value !== null && (value === '' || value === '#' || javascriptUrl.test(value))) {
			report.warn('a11y_invalid_attribute', href, { href_value: value, href_attribute: href.name });
		}
	} else if (
		!facts.spread &&
		!staticValue(map.get('id')) &&
		!staticValue(map.get('name')) &&
		staticValue(map.get('aria-disabled')) !== 'true'
	) {
		missing(pass, ['href']);
	}
}

function checkInput(pass: Pass): void {
	const { facts, report } = pass;
	const type = facts.map.get('type');
	const typeValue = staticText(type);
	if (typeValue === 'image' && !facts.spread) {
		const required = ['alt', 'aria-label', 'aria-labelledby'];
		if (!required.some((name) => facts.map.has(name)))
			missing(pass, required, 'input type="image"');
	}
	const autocomplete = facts.map.get('autocomplete');
	if (type && autocomplete) {
		const value = staticValue(autocomplete);
		if (!validAutocomplete(value)) {
			report.warn('a11y_autocomplete_valid', autocomplete, {
				value: String(value),
				type: typeValue ?? '...'
			});
		}
	}
}

function checkVideo(pass: Pass): void {
	const { facts, report } = pass;
	const hidden = facts.map.get('aria-hidden');
	if (facts.map.has('muted') || (hidden && staticValue(hidden) === 'true') || facts.spread) return;
	if (!facts.map.has('src')) return;
	const track = facts.element.body.nodes.find(
		(node): node is Element => node.kind === 'element' && node.name === 'track'
	);
	const captioned =
		track?.attributes.some(
			(attribute) =>
				attribute.kind === 'spread' ||
				(attribute.kind === 'attribute' &&
					attribute.name === 'kind' &&
					staticValue(attribute) === 'captions')
		) ?? false;
	if (!captioned) report.warn('a11y_media_has_caption', facts.element);
}

function checkFigure(pass: Pass): void {
	const visible = pass.facts.element.body.nodes.filter(
		(node) => node.kind !== 'comment' && (node.kind !== 'text' || notWhitespace.test(node.data))
	);
	const index = visible.findIndex((node) => node.kind === 'element' && node.name === 'figcaption');
	if (index > 0 && index !== visible.length - 1) {
		pass.report.warn('a11y_figcaption_index', visible[index] as Node);
	}
}

export function checkElementRules(pass: Pass): void {
	const { facts, report } = pass;
	const { element, name } = facts;
	switch (name) {
		case 'a':
		case 'button':
			checkLink(pass);
			break;
		case 'input':
			checkInput(pass);
			break;
		case 'img': {
			const alt = staticText(facts.map.get('alt'));
			const hidden = staticValue(facts.map.get('aria-hidden'));
			if (alt && !hidden && !facts.spread && redundantAlt.test(alt)) {
				report.warn('a11y_img_redundant_alt', element);
			}
			break;
		}
		case 'label':
			if (!facts.spread && !facts.map.has('for') && !hasControl(element.body)) {
				report.warn('a11y_label_has_associated_control', element);
			}
			break;
		case 'video':
			checkVideo(pass);
			break;
		case 'figcaption':
			if (!parentIs(pass.path, ['figure'])) report.warn('a11y_figcaption_parent', element);
			break;
		case 'figure':
			checkFigure(pass);
			break;
	}

	if (!facts.spread && name !== 'a') {
		const required = requiredAttributes.get(name);
		if (required !== undefined && !required.some((attribute) => facts.map.has(attribute))) {
			missing(pass, required);
		}
	}
	if (distractingElements.has(name)) report.warn('a11y_distracting_elements', element, { name });
	if (
		!facts.spread &&
		!labelled(facts) &&
		!facts.contenteditableBinding &&
		headings.has(name) &&
		!hasContent(element)
	) {
		report.warn('a11y_missing_content', element, { name });
	}
}
