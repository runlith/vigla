import { elementRoles, roles, type ARIARoleDefinitionKey } from 'aria-query';
import { AXObjectRoles, AXObjects, elementAXObjects } from 'axobject-query';
import { staticText, staticValue, type Facts } from './facts.ts';
import {
	comboboxIfList,
	implicitSemantics,
	inputRoles,
	menuitemRoles,
	presentationRoles
} from './tables.ts';

export const ariaRoles: readonly string[] = roles.keys();

const knownRoles: ReadonlySet<string> = new Set(ariaRoles);

const abstractRoles: ReadonlySet<string> = new Set(
	ariaRoles.filter((role) => roles.get(role as ARIARoleDefinitionKey)?.abstract)
);

const concreteRoles = ariaRoles.filter((role) => !abstractRoles.has(role));

const widgetLike = new Set(['toolbar', 'tabpanel', 'generic', 'cell']);

const nonInteractiveRoles: ReadonlySet<string> = new Set([
	...concreteRoles.filter(
		(name) =>
			!widgetLike.has(name) &&
			!roles
				.get(name as ARIARoleDefinitionKey)
				?.superClass.some((chain) => chain.includes('widget') || chain.includes('window'))
	),
	'progressbar'
]);

const interactiveRoles: ReadonlySet<string> = new Set(
	concreteRoles.filter((name) => !nonInteractiveRoles.has(name) && name !== 'generic')
);

export function isKnown(role: string): boolean {
	return knownRoles.has(role);
}

export function isAbstract(role: string | null): boolean {
	return role !== null && abstractRoles.has(role);
}

export function isInteractive(role: string | null): boolean {
	return role !== null && interactiveRoles.has(role);
}

export function isNonInteractive(role: string | null): boolean {
	return role !== null && nonInteractiveRoles.has(role);
}

export function isPresentation(role: string | null): boolean {
	return role !== null && presentationRoles.has(role);
}

interface Schema {
	readonly name: string;
	readonly attributes?: readonly { readonly name: string; readonly value?: string | number }[];
}

class Schemas {
	readonly #byName = new Map<string, Schema[]>();

	add(schema: Schema): void {
		const list = this.#byName.get(schema.name);
		if (list === undefined) this.#byName.set(schema.name, [schema]);
		else list.push(schema);
	}

	match(facts: Facts): boolean {
		return (this.#byName.get(facts.name) ?? []).some((schema) =>
			(schema.attributes ?? []).every((wanted) => {
				const attribute = facts.map.get(wanted.name);
				if (attribute === undefined) return false;
				return !wanted.value || wanted.value === staticText(attribute);
			})
		);
	}
}

const interactiveElementRoles = new Schemas();
const nonInteractiveElementRoles = new Schemas();
for (const [schema, set] of elementRoles.entries()) {
	const list = [...set];
	if (list.every((role) => role !== 'generic' && nonInteractiveRoles.has(role))) {
		nonInteractiveElementRoles.add(schema);
	}
	if (list.every((role) => interactiveRoles.has(role))) interactiveElementRoles.add(schema);
}

const interactiveElementObjects = new Schemas();
const nonInteractiveElementObjects = new Schemas();
for (const [schema, set] of elementAXObjects.entries()) {
	const types = [...set].map((name) => AXObjects.get(name)?.type);
	if (types.every((type) => type === 'widget')) interactiveElementObjects.add(schema);
	if (types.every((type) => type === 'windows' || type === 'structure')) {
		nonInteractiveElementObjects.add(schema);
	}
}

export type Interactivity = 'interactive' | 'non-interactive' | 'static';

export function interactivity(facts: Facts): Interactivity {
	if (interactiveElementRoles.match(facts)) return 'interactive';
	if (facts.name !== 'header' && nonInteractiveElementRoles.match(facts)) return 'non-interactive';
	if (interactiveElementObjects.match(facts)) return 'interactive';
	if (nonInteractiveElementObjects.match(facts)) return 'non-interactive';
	return 'static';
}

interface Semantic {
	readonly attributes: readonly { readonly name: string; readonly value?: string }[] | undefined;
	readonly roles: ReadonlySet<string>;
}

const semanticByName = new Map<string, Semantic[]>();
for (const [schema, objects] of elementAXObjects.entries()) {
	const names = new Set<string>();
	for (const object of objects) {
		for (const role of AXObjectRoles.get(object) ?? []) names.add(role.name);
	}
	const entry = { attributes: schema.attributes, roles: names };
	const list = semanticByName.get(schema.name);
	if (list === undefined) semanticByName.set(schema.name, [entry]);
	else list.push(entry);
}

export function isSemanticRoleElement(role: string, facts: Facts): boolean {
	return (semanticByName.get(facts.name) ?? []).some(
		(entry) =>
			entry.roles.has(role) &&
			(entry.attributes ?? []).every(
				(wanted) =>
					facts.map.has(wanted.name) && staticValue(facts.map.get(wanted.name)) === wanted.value
			)
	);
}

function typedRole(
	facts: Facts,
	table: ReadonlyMap<string, string>,
	list: boolean
): string | undefined {
	const type = facts.map.get('type');
	if (type === undefined) return undefined;
	const value = staticText(type);
	if (!value) return undefined;
	if (list && facts.map.has('list') && comboboxIfList.has(value)) return 'combobox';
	return table.get(value);
}

export function implicitRole(facts: Facts): string | undefined {
	if (facts.name === 'menuitem') return typedRole(facts, menuitemRoles, false);
	if (facts.name === 'input') return typedRole(facts, inputRoles, true);
	return implicitSemantics.get(facts.name);
}

const roleSeparator = /[ \t\n\r\f]+/g;

export function roleTokens(value: string): string[] {
	return value.replace(/[A-Z]/g, (char) => char.toLowerCase()).split(roleSeparator);
}

export function effectiveRole(value: string | null): string | null {
	if (value === null) return null;
	return (
		roleTokens(value).find((role) => knownRoles.has(role) && !abstractRoles.has(role)) ?? value
	);
}

export function requiredProps(role: string): readonly string[] | undefined {
	const definition = roles.get(role as ARIARoleDefinitionKey);
	return definition === undefined ? undefined : Object.keys(definition.requiredProps);
}

export function supportedProps(role: string): object | undefined {
	return roles.get(role as ARIARoleDefinitionKey)?.props;
}
