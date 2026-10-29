import { aria, type ARIAProperty, type ARIAPropertyDefinition } from 'aria-query';
import type { Node, Property } from '../../../ir/nodes.ts';
import type { Report } from '../report.ts';
import {
	isDisabled,
	isHidden,
	list,
	parentIs,
	staticValue,
	type Facts,
	type Static
} from './facts.ts';
import { closest } from './fuzzy.ts';
import {
	ariaRoles,
	implicitRole,
	isAbstract,
	isInteractive,
	isKnown,
	isNonInteractive,
	isPresentation,
	isSemanticRoleElement,
	requiredProps,
	roleTokens,
	type Interactivity
} from './roles.ts';
import {
	ariaAttributeSet,
	ariaAttributes,
	interactiveHandlers,
	interactiveRoleExceptions,
	invisibleElements,
	nestedImplicitSemantics
} from './tables.ts';

const heading = /^h[1-6]$/;
const whitespace = /\s+/;

export interface Pass {
	readonly facts: Facts;
	readonly interactivity: Interactivity;
	readonly path: readonly Node[];
	readonly report: Report;
}

function quoted(values: readonly (string | number | boolean)[]): string {
	return list(values.map((value) => `"${value}"`));
}

function checkValue(
	attribute: Property,
	name: string,
	schema: ARIAPropertyDefinition,
	found: Static,
	report: Report
): void {
	if (found === null) return;
	const value = found === true ? '' : found;
	const args = { attribute: name };
	switch (schema.type) {
		case 'id':
		case 'string':
			if (value === '') {
				report.warn('a11y_incorrect_aria_attribute_type', attribute, {
					...args,
					type: 'non-empty string'
				});
			}
			break;
		case 'number':
			if (value === '' || Number.isNaN(+value)) {
				report.warn('a11y_incorrect_aria_attribute_type', attribute, { ...args, type: 'number' });
			}
			break;
		case 'boolean':
			if (value !== 'true' && value !== 'false') {
				report.warn('a11y_incorrect_aria_attribute_type_boolean', attribute, args);
			}
			break;
		case 'idlist':
			if (value === '') report.warn('a11y_incorrect_aria_attribute_type_idlist', attribute, args);
			break;
		case 'integer':
			if (value === '' || !Number.isInteger(+value)) {
				report.warn('a11y_incorrect_aria_attribute_type_integer', attribute, args);
			}
			break;
		case 'token': {
			const values = (schema.values ?? []).map(String);
			if (!values.includes(value.toLowerCase())) {
				report.warn('a11y_incorrect_aria_attribute_type_token', attribute, {
					...args,
					values: quoted(values)
				});
			}
			break;
		}
		case 'tokenlist': {
			const values = (schema.values ?? []).map(String);
			if (
				value
					.toLowerCase()
					.split(whitespace)
					.some((token) => !values.includes(token))
			) {
				report.warn('a11y_incorrect_aria_attribute_type_tokenlist', attribute, {
					...args,
					values: quoted(values)
				});
			}
			break;
		}
		case 'tristate':
			if (value !== 'true' && value !== 'false' && value !== 'mixed') {
				report.warn('a11y_incorrect_aria_attribute_type_tristate', attribute, args);
			}
			break;
	}
}

function checkAria(attribute: Property, name: string, pass: Pass): void {
	const { facts, report } = pass;
	if (invisibleElements.has(facts.name)) {
		report.warn('a11y_aria_attributes', attribute, { name: facts.name });
	}
	const type = name.slice(5);
	if (!ariaAttributeSet.has(type)) {
		report.warn('a11y_unknown_aria_attribute', attribute, {
			attribute: type,
			suggestion: closest(type, ariaAttributes)
		});
	}
	if (name === 'aria-hidden' && heading.test(facts.name)) {
		report.warn('a11y_hidden', attribute, { name: facts.name });
	}
	const schema = aria.get(name as ARIAProperty);
	if (schema !== undefined) checkValue(attribute, name, schema, staticValue(attribute), report);
	if (
		name === 'aria-activedescendant' &&
		!facts.dynamic &&
		pass.interactivity !== 'interactive' &&
		!facts.map.has('tabindex') &&
		!facts.spread
	) {
		report.warn('a11y_aria_activedescendant_has_tabindex', attribute);
	}
}

function checkRoleToken(attribute: Property, role: string, pass: Pass): void {
	const { facts, report } = pass;
	const name = facts.name;
	if (role && isAbstract(role)) {
		report.warn('a11y_no_abstract_role', attribute, { role });
	} else if (role && !isKnown(role)) {
		report.warn('a11y_unknown_role', attribute, { role, suggestion: closest(role, ariaRoles) });
	}

	if (
		role === implicitRole(facts) &&
		!['ul', 'ol', 'li', 'menu'].includes(name) &&
		!((name === 'a' || name === 'area') && !facts.map.has('href'))
	) {
		report.warn('a11y_no_redundant_roles', attribute, { role });
	}
	if (!parentIs(pass.path, ['section', 'article']) && role === nestedImplicitSemantics.get(name)) {
		report.warn('a11y_no_redundant_roles', attribute, { role });
	}

	if (!facts.dynamic && !isSemanticRoleElement(role, facts)) {
		const required = requiredProps(role);
		if (
			required !== undefined &&
			!facts.spread &&
			required.some((prop) => !facts.attributes.some((other) => other.name === prop))
		) {
			report.warn('a11y_role_has_required_aria_props', attribute, {
				role,
				props: list(
					required.map((prop) => `"${prop}"`),
					'and'
				)
			});
		}
	}

	const interactive = pass.interactivity === 'interactive';
	if (
		!facts.spread &&
		!isDisabled(facts) &&
		!isHidden(facts) &&
		!isPresentation(role) &&
		isInteractive(role) &&
		pass.interactivity === 'static' &&
		!facts.map.get('tabindex') &&
		[...facts.handlers].some((handler) => interactiveHandlers.has(handler))
	) {
		report.warn('a11y_interactive_supports_focus', facts.element, { role });
	}
	if (!facts.spread && interactive && (isNonInteractive(role) || isPresentation(role))) {
		report.warn('a11y_no_interactive_element_to_noninteractive_role', facts.element, {
			element: name,
			role
		});
	}
	if (
		!facts.spread &&
		pass.interactivity === 'non-interactive' &&
		isInteractive(role) &&
		!interactiveRoleExceptions.get(name)?.has(role)
	) {
		report.warn('a11y_no_noninteractive_element_to_interactive_role', facts.element, {
			element: name,
			role
		});
	}
}

export function checkAttributes(pass: Pass): void {
	const { facts, report } = pass;
	for (const attribute of facts.element.attributes) {
		if (attribute.kind !== 'attribute') continue;
		const name = attribute.name.toLowerCase();
		if (name.startsWith('aria-')) checkAria(attribute, name, pass);
		switch (name) {
			case 'role': {
				if (invisibleElements.has(facts.name)) {
					report.warn('a11y_misplaced_role', attribute, { name: facts.name });
				}
				const value = staticValue(attribute);
				if (typeof value !== 'string') break;
				for (const role of roleTokens(value)) checkRoleToken(attribute, role, pass);
				break;
			}
			case 'accesskey':
				report.warn('a11y_accesskey', attribute);
				break;
			case 'autofocus':
				if (facts.name !== 'dialog' && !parentIs(pass.path, ['dialog'])) {
					report.warn('a11y_autofocus', attribute);
				}
				break;
			case 'scope':
				if (!facts.dynamic && facts.name !== 'th') report.warn('a11y_misplaced_scope', attribute);
				break;
			case 'tabindex': {
				const value = Number(staticValue(attribute));
				if (!Number.isNaN(value) && value > 0) report.warn('a11y_positive_tabindex', attribute);
				break;
			}
		}
	}
}
