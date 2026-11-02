import type { DynamicElement, Element, Node, Property } from '../../../ir/nodes.ts';
import { nameOf } from '../report.ts';
import { contentEditableBindings } from './tables.ts';

export type Static = string | true | null;

export function staticValue(attribute: Property | undefined): Static {
	if (attribute === undefined) return null;
	const value = attribute.value;
	if (value.kind === 'boolean') return true;
	if (value.kind === 'text' && value.parts.length === 1 && value.parts[0]?.kind === 'text') {
		return value.parts[0].data;
	}
	return null;
}

export function staticText(attribute: Property | undefined): string | null {
	const value = staticValue(attribute);
	return value === true ? null : value;
}

export function isEvent(attribute: Property): boolean {
	return attribute.value.kind === 'expression' && attribute.name.startsWith('on');
}

export interface Facts {
	readonly element: Element | DynamicElement;
	readonly name: string;
	readonly dynamic: boolean;
	readonly map: ReadonlyMap<string, Property>;
	readonly attributes: readonly Property[];
	readonly handlers: ReadonlySet<string>;
	readonly spread: boolean;
	readonly contenteditable: boolean;
	readonly contenteditableBinding: boolean;
}

export function elementName(element: Element | DynamicElement): string {
	return element.kind === 'element' ? element.name : nameOf('element');
}

export function collect(element: Element | DynamicElement): Facts {
	const map = new Map<string, Property>();
	const attributes: Property[] = [];
	const handlers = new Set<string>();
	let spread = false;
	let contenteditable = false;
	let contenteditableBinding = false;
	for (const attribute of element.attributes) {
		if (attribute.kind === 'attribute') {
			if (isEvent(attribute)) {
				handlers.add(attribute.name.slice(2));
			} else {
				attributes.push(attribute);
				map.set(attribute.name, attribute);
				if (attribute.name === 'contenteditable') contenteditable = true;
			}
		} else if (attribute.kind === 'spread') {
			spread = true;
		} else if (attribute.kind === 'binding' && contentEditableBindings.has(attribute.name)) {
			contenteditableBinding = true;
		}
	}
	return {
		element,
		name: elementName(element),
		dynamic: element.kind === 'dynamic-element',
		map,
		attributes,
		handlers,
		spread,
		contenteditable,
		contenteditableBinding
	};
}

export function isHidden(facts: Facts): boolean {
	if (facts.name === 'input' && staticValue(facts.map.get('type')) === 'hidden') return true;
	const hidden = facts.map.get('aria-hidden');
	if (hidden === undefined) return false;
	const value = staticValue(hidden);
	return value === null || value === true || value === 'true';
}

export function isDisabled(facts: Facts): boolean {
	if (staticValue(facts.map.get('disabled'))) return true;
	return staticValue(facts.map.get('aria-disabled')) === 'true';
}

export function parentIs(path: readonly Node[], names: readonly string[]): boolean {
	for (let index = path.length - 1; index >= 0; index--) {
		const parent = path[index];
		if (parent?.kind === 'dynamic-element') return true;
		if (parent?.kind === 'element') return names.includes(parent.name);
	}
	return false;
}

export function list(strings: readonly string[], conjunction = 'or'): string {
	if (strings.length < 3) return strings.join(` ${conjunction} `);
	return `${strings.slice(0, -1).join(', ')} ${conjunction} ${strings.at(-1)}`;
}
