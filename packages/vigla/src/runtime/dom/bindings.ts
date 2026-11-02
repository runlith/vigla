import {
	active,
	alias,
	current,
	onMerge,
	open,
	processing,
	tick,
	type Batch
} from '../reactivity/batch.ts';
import { effect, teardown, template } from '../reactivity/effects.ts';
import { original } from '../reactivity/proxy.ts';
import { untrack } from '../reactivity/tracking.ts';
import { unowned } from './events.ts';
import { hydrating } from './hydration.ts';
import { onReset } from './reset.ts';

type Get<T> = () => T;
type Set<T> = (value: T) => void;

interface Valued {
	__value?: unknown;
}

function markEdits(writes: WeakSet<Batch>, batch: Batch): void {
	const target = alias(batch);
	if (writes.has(target)) return;
	writes.add(target);
	onMerge(target, (_from, into) => writes.add(alias(into)));
}

export class BindingEdits {
	readonly #writes = new WeakSet<Batch>();

	record(): void {
		if (active === null && open === null && processing === null) return;
		markEdits(this.#writes, current());
	}

	hasCurrent(): boolean {
		return processing !== null && this.#writes.has(alias(processing));
	}
}

function listenWithReset(
	element: Element,
	type: string,
	handler: (reset: boolean) => void,
	reset: (reset: boolean) => void = handler
): void {
	element.addEventListener(type, () => unowned(() => handler(false)));
	teardown(onReset(element, () => reset(true)));
}

function numeric(input: HTMLInputElement): boolean {
	return input.type === 'number' || input.type === 'range';
}

function toNumber(value: string): number | null {
	return value === '' ? null : +value;
}

export function bindValue(
	input: HTMLInputElement,
	get: Get<unknown>,
	set: Set<unknown> = get as Set<unknown>
): void {
	const edits = new BindingEdits();
	listenWithReset(input, 'input', (reset) => {
		const raw = reset ? input.defaultValue : input.value;
		let value: unknown = numeric(input) ? toNumber(raw) : raw;
		set(value);
		edits.record();
		void tick().then(() => {
			if (value === (value = get())) return;
			const start = input.selectionStart;
			const end = input.selectionEnd;
			const length = input.value.length;
			input.value = (value ?? '') as string;
			if (end === null) return;
			const next = input.value.length;
			if (start === end && end === length && next > length) {
				input.selectionStart = next;
				input.selectionEnd = next;
			} else {
				input.selectionStart = start;
				input.selectionEnd = Math.min(end, next);
			}
		});
	});
	if ((hydrating && input.defaultValue !== input.value) || (untrack(get) == null && input.value)) {
		set(numeric(input) ? toNumber(input.value) : input.value);
		edits.record();
	}
	template(() => {
		const value = get();
		if (input.ownerDocument.activeElement === input && edits.hasCurrent()) return;
		if (numeric(input) && value === toNumber(input.value)) return;
		if (input.type === 'date' && !value && !input.value) return;
		if (value !== input.value) input.value = (value ?? '') as string;
	});
}

export function bindChecked(
	input: HTMLInputElement,
	get: Get<unknown>,
	set: Set<unknown> = get as Set<unknown>
): void {
	listenWithReset(input, 'change', (reset) => set(reset ? input.defaultChecked : input.checked));
	if ((hydrating && input.defaultChecked !== input.checked) || untrack(get) == null) {
		set(input.checked);
	}
	template(() => {
		input.checked = Boolean(get());
	});
}

export function bindIndeterminate(
	input: HTMLInputElement,
	get: Get<unknown>,
	set: Set<unknown>
): void {
	input.addEventListener('change', () => unowned(() => set(input.indeterminate)));
	template(() => {
		input.indeterminate = Boolean(get());
	});
}

function inputValue(input: HTMLInputElement): unknown {
	return '__value' in input ? (input as HTMLInputElement & Valued).__value : input.value;
}

function groupValue(group: readonly HTMLInputElement[], own: unknown, checked: boolean): unknown[] {
	const values = new globalThis.Set<unknown>();
	for (const input of group) if (input.checked) values.add(inputValue(input));
	if (!checked) values.delete(own);
	return [...values];
}

const sorting = new globalThis.Set<HTMLInputElement[]>();

export function bindGroup(
	group: HTMLInputElement[],
	input: HTMLInputElement,
	get: Get<unknown>,
	set: Set<unknown> = get as Set<unknown>
): void {
	const checkbox = input.getAttribute('type') === 'checkbox';
	let mismatched = false;
	group.push(input);
	listenWithReset(
		input,
		'change',
		() => {
			let value = inputValue(input);
			if (checkbox) value = groupValue(group, value, input.checked);
			set(value);
		},
		() => set(checkbox ? [] : null)
	);
	template(() => {
		const value = get();
		if (hydrating && input.defaultChecked !== input.checked) {
			mismatched = true;
			return;
		}
		const own = inputValue(input);
		input.checked = checkbox
			? ((value as unknown[] | null) ?? []).includes(own)
			: Object.is(own, value);
	});
	teardown(() => {
		const index = group.indexOf(input);
		if (index !== -1) group.splice(index, 1);
	});
	if (!sorting.has(group)) {
		sorting.add(group);
		queueMicrotask(() => {
			group.sort((a, b) => (a.compareDocumentPosition(b) === 4 ? -1 : 1));
			sorting.delete(group);
		});
	}
	queueMicrotask(() => {
		if (!mismatched) return;
		if (checkbox) set(groupValue(group, undefined, input.checked));
		else {
			const chosen = group.find((candidate) => candidate.checked);
			set(chosen === undefined ? undefined : inputValue(chosen));
		}
	});
}

export function bindFiles(input: HTMLInputElement, get: Get<unknown>, set: Set<unknown>): void {
	listenWithReset(input, 'change', () => set(input.files));
	if (hydrating && input.files) set(input.files);
	template(() => {
		const files = get() as FileList | null;
		if (files && input.files !== files) input.files = files;
	});
}

export function bindContentEditable(
	property: 'innerHTML' | 'innerText' | 'textContent',
	element: HTMLElement,
	get: Get<unknown>,
	set: Set<unknown>
): void {
	element.addEventListener('input', () => unowned(() => set(element[property])));
	template(() => {
		const value = get();
		if (element[property] === value) return;
		if (value == null) set(element[property]);
		else element[property] = String(value);
	});
}

export function bindProperty(
	property: string,
	type: string,
	element: EventTarget,
	set: Set<unknown>,
	get?: Get<unknown>
): void {
	const target = element as unknown as Record<string, unknown>;
	const handler = (): void => unowned(() => set(target[property]));
	element.addEventListener(type, handler);
	teardown(() => element.removeEventListener(type, handler));
	if (get !== undefined) {
		template(() => {
			target[property] = get();
		});
	} else {
		handler();
	}
}

export function bindFocused(element: HTMLElement, set: Set<boolean>): void {
	const handler = (): void => unowned(() => set(element === document.activeElement));
	handler();
	element.addEventListener('focus', handler);
	element.addEventListener('blur', handler);
	teardown(() => {
		element.removeEventListener('focus', handler);
		element.removeEventListener('blur', handler);
	});
}

type Listener = (entry: ResizeObserverEntry) => void;

class Resizes {
	readonly #options: ResizeObserverOptions;
	readonly #listeners = new WeakMap<Element, globalThis.Set<Listener>>();
	#observer: ResizeObserver | null = null;

	constructor(options: ResizeObserverOptions) {
		this.#options = options;
	}

	observe(element: Element, listener: Listener): () => void {
		let listeners = this.#listeners.get(element);
		if (listeners === undefined) {
			listeners = new globalThis.Set();
			this.#listeners.set(element, listeners);
		}
		listeners.add(listener);
		this.#observer ??= new ResizeObserver((entries) => {
			for (const entry of entries) {
				for (const each of this.#listeners.get(entry.target) ?? []) each(entry);
			}
		});
		this.#observer.observe(element, this.#options);
		return () => {
			const found = this.#listeners.get(element);
			found?.delete(listener);
			if (found?.size === 0) {
				this.#listeners.delete(element);
				this.#observer?.unobserve(element);
			}
		};
	}
}

const contentBoxes = new Resizes({ box: 'content-box' });
const borderBoxes = new Resizes({ box: 'border-box' });
const pixelBoxes = new Resizes({ box: 'device-pixel-content-box' });

export function bindBox(element: Element, name: string, set: Set<unknown>): void {
	const observer =
		name === 'contentRect' || name === 'contentBoxSize'
			? contentBoxes
			: name === 'borderBoxSize'
				? borderBoxes
				: pixelBoxes;
	teardown(
		observer.observe(element, (entry) => set((entry as unknown as Record<string, unknown>)[name]))
	);
}

export function bindSize(element: Element, name: string, set: Set<unknown>): void {
	const read = (): unknown => (element as unknown as Record<string, unknown>)[name];
	const release = borderBoxes.observe(element, () => set(read()));
	effect(() => {
		untrack(() => set(read()));
		return release;
	});
}

function matches(value: unknown, reference: unknown): boolean {
	return value === reference || original(value) === reference;
}

export function bindThis<T>(
	value: T,
	update: (value: T | null, ...parts: unknown[]) => void,
	read: (...parts: unknown[]) => unknown,
	parts?: () => unknown[]
): T {
	effect(() => {
		let current: unknown[] | null = null;
		template(() => {
			const previous = current;
			const next = parts?.() ?? [];
			current = next;
			untrack(() => {
				if (matches(read(...next), value)) return;
				update(value, ...next);
				if (previous !== null && matches(read(...previous), value)) update(null, ...previous);
			});
		});
		return () => {
			if (current !== null && matches(read(...current), value)) update(null, ...current);
		};
	});
	return value;
}
