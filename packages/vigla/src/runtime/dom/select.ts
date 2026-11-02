import { warn } from '../../shared/diagnostics.ts';
import { namespaces } from '../../shared/html.ts';
import type { Spread } from './attributes.ts';
import { effect, teardown } from '../reactivity/effects.ts';
import { original } from '../reactivity/proxy.ts';
import { unowned } from './events.ts';
import { onReset } from './reset.ts';
import { BindingEdits } from './bindings.ts';

interface Valued {
	__value?: unknown;
}

function optionValue(option: HTMLOptionElement): unknown {
	return '__value' in option ? (option as HTMLOptionElement & Valued).__value : option.value;
}

export function selected(element: Element, next: unknown): void {
	if (next) {
		if (!element.hasAttribute('selected')) element.setAttribute('selected', '');
	} else element.removeAttribute('selected');
}

export function selectOption(select: HTMLSelectElement, value: unknown, mounting = false): void {
	if (select.multiple) {
		if (value == undefined) return;
		if (!Array.isArray(value)) {
			warn(
				'select_multiple_invalid_value',
				'The `value` property of a `<select multiple>` element should be an array, but it received a non-array value. The selection will be kept as is.'
			);
			return;
		}
		for (const option of select.options) option.selected = value.includes(optionValue(option));
		return;
	}
	const chosen = original(value);
	for (const option of select.options) {
		if (Object.is(original(optionValue(option)), chosen)) {
			option.selected = true;
			return;
		}
	}
	if (!mounting || value !== undefined) select.selectedIndex = -1;
}

interface Default {
	value: unknown;
	pending: boolean;
}

const defaults = new WeakMap<HTMLSelectElement, Default>();

export function selectDefault(select: HTMLSelectElement, value: unknown, deferred = false): void {
	const previous = defaults.get(select);
	if (previous !== undefined) {
		if (previous.value === value) return;
		previous.value = value;
		if (!previous.pending) applyDefault(select, true);
		return;
	}
	defaults.set(select, { value, pending: deferred });
	if (!deferred) applyDefault(select, '__value' in select);
}

function initializeDefault(select: HTMLSelectElement): void {
	const value = defaults.get(select);
	if (value?.pending) {
		value.pending = false;
		applyDefault(select, '__value' in select);
	}
}

function applyDefault(select: HTMLSelectElement, preserve: boolean): void {
	const value = defaults.get(select)?.value;
	const multiple = select.multiple;
	const choices = multiple ? (value ?? []) : null;
	if (multiple && !Array.isArray(choices)) return;
	const before = select.selectedIndex;
	const selection = preserve && multiple ? new Set(select.selectedOptions) : null;
	const chosen = original(value);
	for (const option of select.options) {
		const match = Array.isArray(choices)
			? choices.includes(optionValue(option))
			: Object.is(original(optionValue(option)), chosen);
		selected(option, match);
	}
	if (!preserve) return;
	if (selection !== null) {
		for (const option of select.options) {
			const kept = selection.has(option);
			if (option.selected !== kept) option.selected = kept;
		}
	} else if (select.selectedIndex !== before) select.selectedIndex = before;
}

function mirrored(entry: MutationRecord): boolean {
	const target =
		entry.target.nodeType === 1 ? (entry.target as Element) : entry.target.parentElement;
	if (target?.closest('selectedcontent') != null) return true;
	if (entry.type !== 'childList') return false;
	const changed = [...entry.addedNodes, ...entry.removedNodes];
	return (
		changed.length > 0 &&
		changed.every(
			(node) =>
				(node as Element).namespaceURI === namespaces.html &&
				(node as Element).localName === 'selectedcontent'
		)
	);
}

export function initSelect(element: Element, attributes?: () => Spread | undefined): void {
	if (element.namespaceURI !== namespaces.html || element.localName !== 'select') return;
	const select = element as HTMLSelectElement;
	if (attributes !== undefined)
		effect(() => {
			const values = attributes();
			if (values === undefined) return;
			if ('defaultValue' in values) selectDefault(select, values.defaultValue);
			initializeDefault(select);
			if ('value' in values) selectValue(select, values.value);
		});
	const observer = new MutationObserver((entries) => {
		if (entries.every(mirrored)) return;
		if (defaults.has(select)) applyDefault(select, false);
		if ('__value' in select) selectOption(select, (select as HTMLSelectElement & Valued).__value);
	});
	observer.observe(select, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['value']
	});
	teardown(() => observer.disconnect());
}

export function selectValue(select: HTMLSelectElement, value: unknown): void {
	(select as HTMLSelectElement & Valued).__value = value;
	selectOption(select, value, true);
}

export function bindSelect(
	select: HTMLSelectElement,
	get: () => unknown,
	set: (value: unknown) => void = get as (value: unknown) => void
): void {
	let mounting = true;
	const edits = new BindingEdits();
	const change = (reset: boolean): void =>
		unowned(() => {
			const query = reset ? '[selected]' : ':checked';
			let value: unknown;
			if (select.multiple) {
				value = [...select.querySelectorAll<HTMLOptionElement>(query)].map(optionValue);
			} else {
				const chosen =
					select.querySelector<HTMLOptionElement>(query) ??
					select.querySelector<HTMLOptionElement>('option:not([disabled])');
				value = chosen && optionValue(chosen);
			}
			set(value);
			edits.record();
			(select as HTMLSelectElement & Valued).__value = value;
		});
	select.addEventListener('change', () => change(false));
	teardown(onReset(select, () => change(true)));
	effect(() => {
		if (mounting) initializeDefault(select);
		let value = get();
		if (select.ownerDocument.activeElement === select && edits.hasCurrent()) return;
		selectOption(select, value, mounting);
		if (mounting && value === undefined) {
			const chosen = select.querySelector<HTMLOptionElement>(':checked');
			if (chosen !== null) {
				value = optionValue(chosen);
				set(value);
			}
		}
		(select as HTMLSelectElement & Valued).__value = value;
		mounting = false;
	});
	initSelect(select);
}
