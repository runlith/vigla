import { warn } from '../../shared/diagnostics.ts';
import { effect, teardown } from '../reactivity/effects.ts';
import { setOwner, untrack } from '../reactivity/tracking.ts';

interface Valued {
	__value?: unknown;
}

function optionValue(option: HTMLOptionElement): unknown {
	return '__value' in option ? (option as HTMLOptionElement & Valued).__value : option.value;
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
	for (const option of select.options) {
		if (Object.is(optionValue(option), value)) {
			option.selected = true;
			return;
		}
	}
	if (!mounting || value !== undefined) select.selectedIndex = -1;
}

export function initSelect(select: HTMLSelectElement): void {
	const observer = new MutationObserver(() => {
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
	select.addEventListener('change', () => {
		const previous = setOwner(null);
		try {
			untrack(() => {
				let value: unknown;
				if (select.multiple) {
					value = [...select.querySelectorAll<HTMLOptionElement>(':checked')].map(optionValue);
				} else {
					const chosen =
						select.querySelector<HTMLOptionElement>(':checked') ??
						select.querySelector<HTMLOptionElement>('option:not([disabled])');
					value = chosen && optionValue(chosen);
				}
				set(value);
				(select as HTMLSelectElement & Valued).__value = value;
			});
		} finally {
			setOwner(previous);
		}
	});
	effect(() => {
		let value = get();
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
