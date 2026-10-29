import { aria } from 'aria-query';
import type { Pass } from './attributes.ts';
import { isHidden, list, staticText } from './facts.ts';
import {
	effectiveRole,
	implicitRole,
	isAbstract,
	isInteractive,
	isKnown,
	isNonInteractive,
	isPresentation,
	supportedProps
} from './roles.ts';
import { interactiveHandlers, recommendedInteractiveHandlers } from './tables.ts';

const ariaProperties: ReadonlySet<string> = new Set(aria.keys());

export function checkInteractions(pass: Pass): void {
	const { facts, report } = pass;
	const { element, handlers, map, name } = facts;
	const interactive = pass.interactivity === 'interactive';
	const nonInteractive = pass.interactivity === 'non-interactive';
	const role = map.get('role');
	const roleValue = effectiveRole(staticText(role));

	if (handlers.has('click')) {
		const nonPresentation = roleValue !== null && !isPresentation(roleValue);
		if (
			!facts.dynamic &&
			!isHidden(facts) &&
			(role === undefined || nonPresentation) &&
			!interactive &&
			!facts.spread &&
			!handlers.has('keydown') &&
			!handlers.has('keyup') &&
			!handlers.has('keypress')
		) {
			report.warn('a11y_click_events_have_key_events', element, { element: name });
		}
	}

	const effective = role === undefined ? implicitRole(facts) : roleValue;

	if (!facts.dynamic && !interactive && !isInteractive(roleValue)) {
		const tabindex = map.get('tabindex');
		const value = staticText(tabindex);
		if (tabindex !== undefined && (value === null || Number(value) >= 0)) {
			report.warn('a11y_no_noninteractive_tabindex', element);
		}
	}

	if (typeof effective === 'string' && isKnown(effective)) {
		const props = supportedProps(effective) ?? {};
		for (const attribute of facts.attributes) {
			if (!ariaProperties.has(attribute.name) || attribute.name in props) continue;
			if (role === undefined) {
				report.warn('a11y_role_supports_aria_props_implicit', attribute, {
					attribute: attribute.name,
					role: effective,
					name
				});
			} else {
				report.warn('a11y_role_supports_aria_props', attribute, {
					attribute: attribute.name,
					role: effective
				});
			}
		}
	}

	const hidden = isHidden(facts);
	if (
		!facts.spread &&
		!facts.contenteditable &&
		!hidden &&
		!isPresentation(roleValue) &&
		((!interactive && isNonInteractive(roleValue)) || (nonInteractive && role === undefined)) &&
		[...handlers].some((handler) => recommendedInteractiveHandlers.has(handler))
	) {
		report.warn('a11y_no_noninteractive_element_interactions', element, { element: name });
	}

	if (
		!facts.spread &&
		(role === undefined || roleValue !== null) &&
		!hidden &&
		!isPresentation(roleValue) &&
		!interactive &&
		!isInteractive(roleValue) &&
		!nonInteractive &&
		!isNonInteractive(roleValue) &&
		!isAbstract(roleValue)
	) {
		const used = [...handlers].filter((handler) => interactiveHandlers.has(handler));
		if (used.length > 0) {
			report.warn('a11y_no_static_element_interactions', element, {
				element: name,
				handler: list(used)
			});
		}
	}

	if (
		!facts.spread &&
		handlers.has('mouseover') &&
		!handlers.has('focus') &&
		!handlers.has('focusin')
	) {
		report.warn('a11y_mouse_events_have_key_events', element, {
			event: 'mouseover',
			accompanied_by: 'focus'
		});
	}
	if (
		!facts.spread &&
		handlers.has('mouseout') &&
		!handlers.has('blur') &&
		!handlers.has('focusout')
	) {
		report.warn('a11y_mouse_events_have_key_events', element, {
			event: 'mouseout',
			accompanied_by: 'blur'
		});
	}
}
