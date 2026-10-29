import {
	clsx,
	toClass,
	toStyle,
	type StyleDirectives,
	type Styles
} from '../../shared/attributes.ts';
import { isCapture, isDelegated, namespaces, propertyName } from '../../shared/html.ts';
import { delegated, delegate, listen } from './events.ts';
import { hydrating } from './hydration.ts';

type Directives = Readonly<Record<string, unknown>>;

type Values = Record<string, unknown>;

const cache = Symbol('attributes');

interface Holder {
	[cache]?: Values;
}

function values(element: Element): Values {
	const holder = element as Element & Holder;
	return (holder[cache] ??= {});
}

const setters = new Map<string, Set<string>>();

function setterNames(element: Element): Set<string> {
	const key = element.getAttribute('is') ?? element.nodeName;
	let found = setters.get(key);
	if (found !== undefined) return found;
	found = new Set();
	setters.set(key, found);
	let prototype = element as object | null;
	const stop = Element.prototype;
	while (prototype !== null && prototype !== stop) {
		const descriptors = Object.getOwnPropertyDescriptors(prototype);
		for (const name of Object.keys(descriptors)) {
			if (descriptors[name]?.set) found.add(name);
		}
		prototype = Object.getPrototypeOf(prototype) as object | null;
	}
	return found;
}

function keepsNetwork(element: Element, name: string): boolean {
	return name === 'src' || name === 'srcset' || (name === 'href' && element.nodeName === 'LINK');
}

export function attr(element: Element, name: string, value: unknown): void {
	const known = values(element);
	if (hydrating) {
		known[name] = element.getAttribute(name);
		if (keepsNetwork(element, name)) return;
	}
	const previous = known[name];
	if (previous === value) return;
	known[name] = value;
	if (value == null) {
		element.removeAttribute(name);
	} else if (typeof value !== 'string' && setterNames(element).has(name)) {
		(element as unknown as Values)[name] = value;
	} else if (
		!(
			hydrating &&
			(typeof value === 'number' || typeof value === 'boolean') &&
			previous === String(value)
		)
	) {
		element.setAttribute(name, String(value));
	}
}

let resetting = false;

function listenForReset(): void {
	if (resetting) return;
	resetting = true;
	document.addEventListener(
		'reset',
		(event) => {
			void Promise.resolve().then(() => {
				if (event.defaultPrevented) return;
				for (const element of (event.target as HTMLFormElement).elements) {
					(element as Element & { __reset?: () => void }).__reset?.();
				}
			});
		},
		{ capture: true }
	);
}

export function removeInputDefaults(element: Element): void {
	if (!hydrating) return;
	const input = element as HTMLInputElement & { __reset?: () => void };
	let removed = false;
	const remove = (): void => {
		if (removed) return;
		removed = true;
		if (input.hasAttribute('value')) {
			const current = input.value;
			attr(input, 'value', null);
			input.value = current;
		}
		if (input.hasAttribute('checked')) {
			const current = input.checked;
			attr(input, 'checked', null);
			input.checked = current;
		}
	};
	input.__reset = remove;
	queueMicrotask(remove);
	listenForReset();
}

export function removeTextareaChild(element: Element): void {
	if (hydrating && element.firstChild !== null) element.textContent = '';
}

export function customProp(element: Element, name: string, value: unknown): void {
	const registered =
		typeof customElements === 'undefined' ||
		customElements.get(element.getAttribute('is') ?? element.nodeName.toLowerCase()) !== undefined;
	const settable = registered
		? setterNames(element).has(name)
		: value !== null && typeof value === 'object';
	if (name !== 'style' && settable) {
		(element as unknown as Values)[name] = value;
		return;
	}
	attr(element, name, value == null ? value : String(value));
}

export function xlink(element: Element, name: string, value: unknown): void {
	element.setAttributeNS('http://www.w3.org/1999/xlink', name, String(value));
}

interface Valued extends Element {
	value: unknown;
	__value?: unknown;
}

export function value(element: Element, next: unknown): void {
	const known = values(element);
	const target = element as Valued;
	if (known.value === (known.value = next ?? undefined)) return;
	if (target.value === next && (next !== 0 || element.nodeName !== 'PROGRESS')) return;
	target.value = next ?? '';
}

export function optionValue(element: Element, next: unknown): void {
	const target = element as Valued;
	if (target.__value === next && '__value' in target) return;
	target.__value = next;
	target.value = next ?? '';
}

export function checked(element: Element, next: unknown): void {
	const known = values(element);
	if (known.checked === (known.checked = next ?? undefined)) return;
	(element as HTMLInputElement).checked = next as boolean;
}

export function defaultValue(element: Element, next: unknown): void {
	const input = element as HTMLInputElement;
	const current = input.value;
	input.defaultValue = next as string;
	input.value = current;
}

export function defaultChecked(element: Element, next: unknown): void {
	const input = element as HTMLInputElement;
	const current = input.checked;
	input.defaultChecked = next as boolean;
	input.checked = current;
}

export function selected(element: Element, next: unknown): void {
	const option = element as HTMLOptionElement;
	if (next) {
		if (!option.hasAttribute('selected')) option.setAttribute('selected', '');
	} else {
		option.removeAttribute('selected');
	}
}

const classCache = Symbol('class');

interface ClassHolder {
	[classCache]?: unknown;
}

export function className(
	element: Element,
	html: boolean,
	next: unknown,
	hash?: string | null,
	previous?: Directives | null,
	directives?: Directives | null
): Directives | null | undefined {
	const holder = element as Element & ClassHolder;
	const before = holder[classCache];
	if (hydrating || before !== next || before === undefined) {
		const name = toClass(next, hash, directives);
		if (!hydrating || name !== element.getAttribute('class')) {
			if (name == null) element.removeAttribute('class');
			else if (html) element.className = name;
			else element.setAttribute('class', name);
		}
		holder[classCache] = next;
	} else if (directives && previous !== directives) {
		for (const key of Object.keys(directives)) {
			const present = !!directives[key];
			if (previous == null || present !== !!previous[key]) element.classList.toggle(key, present);
		}
	}
	return directives;
}

const styleCache = Symbol('style');

interface StyleHolder {
	[styleCache]?: unknown;
}

function updateStyles(
	element: ElementCSSInlineStyle,
	previous: Styles | null | undefined,
	next: Styles | null | undefined,
	priority?: string
): void {
	for (const key of Object.keys(next ?? {})) {
		const value = (next as Styles)[key];
		if (previous?.[key] === value) continue;
		if (value == null) element.style.removeProperty(key);
		else element.style.setProperty(key, String(value), priority);
	}
}

export function style(
	element: Element,
	next: unknown,
	previous?: StyleDirectives | null,
	directives?: StyleDirectives | null
): StyleDirectives | null | undefined {
	const holder = element as Element & StyleHolder;
	const styled = element as Element & ElementCSSInlineStyle;
	if (hydrating || holder[styleCache] !== next) {
		const css = toStyle(next, directives);
		if (!hydrating || css !== element.getAttribute('style')) {
			if (css == null) element.removeAttribute('style');
			else styled.style.cssText = css;
		}
		holder[styleCache] = next;
	} else if (directives) {
		if (Array.isArray(directives)) {
			const before = previous as readonly [Styles | null, Styles | null] | null | undefined;
			updateStyles(styled, before?.[0], directives[0] as Styles | null);
			updateStyles(styled, before?.[1], directives[1] as Styles | null, 'important');
		} else {
			updateStyles(styled, previous as Styles | null | undefined, directives as Styles);
		}
	}
	return directives;
}

export function autofocus(element: HTMLElement, on: boolean): void {
	if (!on) return;
	const body = document.body;
	element.autofocus = true;
	queueMicrotask(() => {
		if (document.activeElement === body) element.focus();
	});
}

export const CLASS = Symbol('class');

export const STYLE = Symbol('style');

type Spread = Record<string | symbol, unknown>;

interface Listener {
	readonly handle: EventListener;
	readonly capture: boolean;
	readonly type: string;
}

export function attributes(
	element: Element,
	previous: Spread | undefined,
	next: Spread,
	hash?: string | null,
	removeDefaults = false
): Spread {
	if (
		previous === undefined &&
		removeDefaults &&
		element.nodeName === 'INPUT' &&
		!('defaultValue' in next || 'defaultChecked' in next)
	) {
		removeInputDefaults(element);
	}
	const current: Spread = previous ?? {};
	const custom = element.nodeName.includes('-');
	const html = element.namespaceURI === namespaces.html;
	for (const key of Object.keys(current)) {
		if (!(key in next) && !key.startsWith('$$')) next[key] = null;
	}
	if (next.class) next.class = clsx(next.class);
	else if (hash || next[CLASS]) next.class = null;
	if (next[STYLE]) next.style ??= null;
	if (element.nodeName === 'INPUT' && 'type' in next && 'value' in next) {
		if (next.type !== current.type) {
			current.type = next.type;
			attr(element, 'type', next.type);
		}
	}
	for (const key of Object.keys(next)) {
		const value = next[key];
		if (key === 'class') {
			className(
				element,
				html,
				value,
				hash,
				current[CLASS] as Directives | undefined,
				next[CLASS] as Directives | undefined
			);
			current[key] = value;
			current[CLASS] = next[CLASS];
			continue;
		}
		if (key === 'style') {
			style(
				element,
				value,
				current[STYLE] as StyleDirectives | undefined,
				next[STYLE] as StyleDirectives | undefined
			);
			current[key] = value;
			current[STYLE] = next[STYLE];
			continue;
		}
		const before = current[key];
		if (value === before && !(value === undefined && element.hasAttribute(key))) continue;
		current[key] = value;
		if (key.startsWith('$$')) continue;
		if (key.startsWith('on')) {
			let type = key.slice(2);
			const capture = isCapture(type);
			if (capture) type = type.slice(0, -7);
			const slot = `$$${key}`;
			if (!capture && isDelegated(type)) {
				delegated(element, type, value as EventListener | null);
				delegate(type);
				continue;
			}
			const existing = current[slot] as Listener | undefined;
			if (existing !== undefined) {
				if (value != null) continue;
				element.removeEventListener(existing.type, existing.handle, existing.capture);
				current[slot] = undefined;
			}
			if (value != null) {
				const handle: EventListener = function (this: Element, event) {
					(current[key] as EventListener).call(this, event);
				};
				listen(element, type, handle, capture);
				current[slot] = { handle, capture, type } satisfies Listener;
			}
			continue;
		}
		if (key === 'autofocus') {
			autofocus(element as HTMLElement, Boolean(value));
			continue;
		}
		if (!custom && (key === '__value' || (key === 'value' && value != null))) {
			const target = element as Valued;
			target.__value = value;
			if (
				before == null ||
				target.value !== value ||
				(value === 0 && element.nodeName === 'PROGRESS')
			) {
				target.value = value;
			}
			continue;
		}
		if (key === 'selected' && element.nodeName === 'OPTION') {
			selected(element, value);
			continue;
		}
		const name = html ? propertyName(key) : key;
		const fallback = name === 'defaultValue' || name === 'defaultChecked';
		if (element.nodeName === 'SELECT' && name === 'defaultValue') continue;
		if (value == null && !custom && !fallback) {
			values(element)[key] = null;
			if (name === 'value' || name === 'checked') {
				const input = element as HTMLInputElement;
				const initial = previous === undefined;
				if (name === 'value') {
					const kept = input.defaultValue;
					input.removeAttribute(name);
					input.defaultValue = kept;
					input.value = initial ? kept : '';
					(input as Valued).__value = initial ? kept : null;
				} else {
					const kept = input.defaultChecked;
					input.removeAttribute(name);
					input.defaultChecked = kept;
					input.checked = initial ? kept : false;
				}
			} else {
				element.removeAttribute(key);
			}
			continue;
		}
		if (fallback || ((custom || typeof value !== 'string') && setterNames(element).has(name))) {
			(element as unknown as Values)[name] = value;
			delete values(element)[name];
			continue;
		}
		if (typeof value !== 'function') attr(element, name, value);
	}
	return current;
}
