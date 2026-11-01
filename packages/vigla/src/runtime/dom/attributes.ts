import { DEV } from 'esm-env';
import { warn } from '../../shared/diagnostics.ts';
import {
	clsx,
	toClass,
	toStyle,
	type StyleDirectives,
	type Styles
} from '../../shared/attributes.ts';
import { isCapture, isDelegated, namespaces, propertyName } from '../../shared/html.ts';
import { spreadAttachments } from './attachments.ts';
import { delegated, delegate, listen } from './events.ts';
import { claim, cursor, hydrating, setHydrating } from './hydration.ts';
import { owner, setOwner, withoutReaction } from '../reactivity/tracking.ts';
import { teardown } from '../reactivity/effects.ts';
import { task } from '../reactivity/tasks.ts';
import { selectOption } from './select.ts';

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
	return (
		name === 'src' ||
		name === 'srcset' ||
		(name === 'href' && element.namespaceURI === namespaces.html && element.localName === 'link')
	);
}

function sameUrl(left: string, right: string, base: string): boolean {
	if (left === right) return true;
	try {
		return new URL(left, base).href === new URL(right, base).href;
	} catch {
		return false;
	}
}

function sameSrcset(left: string, right: string, base: string): boolean {
	const split = (value: string): string[][] =>
		value.split(',').map((entry) => entry.trim().split(/\s+/));
	const before = split(left);
	const after = split(right);
	return (
		before.length === after.length &&
		before.every((entry, index) => {
			const next = after[index] as string[];
			return (
				entry.slice(1).join(' ') === next.slice(1).join(' ') &&
				sameUrl(entry[0] ?? '', next[0] ?? '', base)
			);
		})
	);
}

function warnNetworkChange(element: Element, name: string, value: unknown): void {
	const before = element.getAttribute(name) ?? '';
	const next = String(value ?? '');
	const base = element.ownerDocument.baseURI;
	if (name === 'srcset' ? sameSrcset(before, next, base) : sameUrl(before, next, base)) return;
	const markup = element.innerHTML
		? element.outerHTML.replace(element.innerHTML, '...')
		: element.outerHTML;
	warn(
		'hydration_attribute_changed',
		`The \`${name}\` attribute on \`${markup}\` changed its value between server and client renders. The client value, \`${next}\`, will be ignored in favour of the server value`
	);
}

export function attr(element: Element, name: string, value: unknown, unchecked = false): void {
	const known = values(element);
	if (hydrating) {
		known[name] = element.getAttribute(name);
		if (keepsNetwork(element, name)) {
			if (DEV && !unchecked) warnNetworkChange(element, name, value);
			return;
		}
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
	if (!hydrating || element.namespaceURI !== namespaces.html) return;
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
	task(remove);
	listenForReset();
}

export function removeTextareaChild(element: Element): void {
	if (hydrating && element.firstChild !== null) element.textContent = '';
}

export function customProp(element: Element, name: string, value: unknown): void {
	const parent = setOwner(null);
	const node = hydrating ? cursor : null;
	const was = setHydrating(false);
	try {
		withoutReaction(() => {
			const registered =
				typeof customElements === 'undefined' ||
				customElements.get(element.getAttribute('is') ?? element.nodeName.toLowerCase()) !==
					undefined;
			const settable = registered
				? setterNames(element).has(name)
				: value !== null && typeof value === 'object';
			if (name !== 'style' && settable) {
				(element as unknown as Values)[name] = value;
				return;
			}
			attr(element, name, value == null ? value : String(value));
		});
	} finally {
		setOwner(parent);
		setHydrating(was);
		if (node !== null) claim(node);
	}
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
	if (
		target.value === next &&
		(next !== 0 || element.localName !== 'progress' || element.namespaceURI !== namespaces.html)
	)
		return;
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

export type Spread = Record<string | symbol, unknown>;

const listeners = Symbol('listeners');

type Listener = () => void;

function listenerSet(current: Spread): Set<Listener> {
	let set = current[listeners] as Set<Listener> | undefined;
	if (set !== undefined) return set;
	set = new Set();
	current[listeners] = set;
	const parent = owner?.parent ?? null;
	const previous = setOwner(parent);
	try {
		withoutReaction(() =>
			teardown(() => {
				for (const remove of set) remove();
				set.clear();
			})
		);
	} finally {
		setOwner(previous);
	}
	return set;
}

export function attributes(
	element: Element,
	previous: Spread | undefined,
	next: Spread,
	hash?: string | null,
	removeDefaults = false,
	unchecked = false
): Spread {
	const html = element.namespaceURI === namespaces.html;
	const tag = html ? element.localName : null;
	if (
		previous === undefined &&
		removeDefaults &&
		tag === 'input' &&
		!('defaultValue' in next || 'defaultChecked' in next)
	) {
		removeInputDefaults(element);
	}
	const current: Spread = previous ?? {};
	const custom = element.nodeName.includes('-') || element.hasAttribute('is');
	const select = tag === 'select';
	for (const key of Object.keys(current)) {
		if (!(key in next) && !key.startsWith('$$')) next[key] = null;
	}
	if (next.class) next.class = clsx(next.class);
	else if (hash || next[CLASS]) next.class = null;
	if (next[STYLE]) next.style ??= null;
	if (tag === 'input' && 'type' in next && 'value' in next) {
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
				existing();
				(current[listeners] as Set<Listener>).delete(existing);
				current[slot] = undefined;
			}
			if (value != null) {
				const handle: EventListener = function (this: Element, event) {
					(current[key] as EventListener).call(this, event);
				};
				const remove = listen(element, type, handle, capture);
				listenerSet(current).add(remove);
				current[slot] = remove;
			}
			continue;
		}
		if (key === 'autofocus') {
			autofocus(element as HTMLElement, Boolean(value));
			continue;
		}
		if (select && key === 'value' && !custom) {
			(element as Valued).__value = value;
			continue;
		}
		if (!custom && (key === '__value' || (key === 'value' && value != null))) {
			const target = element as Valued;
			target.__value = value;
			if (before == null || target.value !== value || (value === 0 && tag === 'progress')) {
				target.value = value;
			}
			continue;
		}
		if (key === 'selected' && tag === 'option') {
			selected(element, value);
			continue;
		}
		const name = html ? propertyName(key) : key;
		const fallback = name === 'defaultValue' || name === 'defaultChecked';
		if (element.localName === 'select' && name === 'defaultValue') continue;
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
		if (typeof value !== 'function') attr(element, name, value, unchecked);
	}
	if (select && previous !== undefined && 'value' in next)
		selectOption(element as HTMLSelectElement, next.value);
	spreadAttachments(element, current, next);
	return current;
}
