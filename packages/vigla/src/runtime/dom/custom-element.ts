import { slots, slotProps } from '../../shared/slots.ts';
import { effectRoot, template } from '../reactivity/effects.ts';
import { proxy } from '../reactivity/proxy.ts';
import { untrack } from '../reactivity/tracking.ts';
import { advance, hydrating } from './hydration.ts';
import { mount, unmount, type Component, type Exports, type Props } from './mount.ts';
import { append } from './template.ts';

export interface ElementProperty {
	readonly attribute?: string;
	readonly reflect?: boolean;
	readonly type?: 'String' | 'Boolean' | 'Number' | 'Array' | 'Object';
}

export type ElementProperties = Readonly<Record<string, ElementProperty>>;
export type ElementExtension = (base: CustomElementConstructor) => CustomElementConstructor;
export type ElementComponent = Component & { element?: CustomElementConstructor };
export type Slot = (anchor: ChildNode, props?: () => Props) => void;

const hosts = new WeakMap<object, HTMLElement>();
const shadows = new WeakMap<HTMLElement, ShadowRoot>();

export function host(props: object): HTMLElement | undefined {
	return hosts.get(props);
}

export function slot(
	anchor: ChildNode,
	props: Props,
	name: string,
	values: Props,
	fallback: Slot | null
): void {
	if (hydrating) advance();
	const element = host(props);
	if (element !== undefined && shadows.has(element)) {
		const node = anchor.ownerDocument!.createElement('slot');
		if (name !== 'default') node.name = name;
		append(anchor, node);
		if (fallback !== null) {
			const end = anchor.ownerDocument!.createTextNode('');
			node.append(end);
			fallback(end);
		}
		return;
	}
	if (element !== undefined && slots(props)[name]) {
		const node = anchor.ownerDocument!.createElement('slot');
		if (name !== 'default') node.name = name;
		append(anchor, node);
		return;
	}
	const snippet = props[name === 'default' ? 'children' : name] as Slot | undefined;
	if (snippet === undefined) fallback?.(anchor);
	else snippet(anchor, () => values);
}

function fromAttribute(value: string | null, type: ElementProperty['type']): unknown {
	switch (type) {
		case 'Boolean':
			return value !== null;
		case 'Number':
			return value === null ? null : +value;
		case 'Object':
		case 'Array':
			return value ? JSON.parse(value) : value;
		default:
			return value;
	}
}

function toAttribute(value: unknown, type: ElementProperty['type']): string | null {
	if (type === 'Boolean') return value ? '' : null;
	if (value == null) return null;
	return type === 'Object' || type === 'Array' ? JSON.stringify(value) : String(value);
}

export function customElement(
	component: ElementComponent,
	properties: ElementProperties,
	exports: readonly string[],
	shadow?: ShadowRootInit,
	extend?: ElementExtension
): CustomElementConstructor {
	const attributes = new Map(
		Object.entries(properties).map(([key, value]) => [(value.attribute ?? key).toLowerCase(), key])
	);
	class Element extends HTMLElement {
		static get observedAttributes(): string[] {
			return [...attributes.keys()];
		}

		#instance: Exports | null = null;
		#props: Props | null = null;
		#values: Props = Object.create(null);
		#connected = false;
		#reflecting = false;
		#stop: (() => void) | null = null;

		constructor() {
			super();
			if (shadow !== undefined) shadows.set(this, this.attachShadow(shadow));
		}

		connectedCallback(): void {
			this.#connected = true;
			if (this.#instance !== null) return;
			Promise.resolve().then(() => {
				if (!this.#connected || this.#instance !== null) return;
				for (const attribute of this.attributes) {
					const key = attributes.get(attribute.name);
					if (key !== undefined && !(key in this.#values)) {
						this.#values[key] = fromAttribute(attribute.value, properties[key]?.type);
					}
				}
				for (const key of Object.keys(properties)) {
					if (!Object.hasOwn(this, key)) continue;
					if (!(key in this.#values)) this.#values[key] = Reflect.get(this, key);
					Reflect.deleteProperty(this, key);
				}
				const available: Record<string, boolean> = Object.create(null);
				for (const child of this.childNodes)
					available[(child as HTMLElement).slot || 'default'] = true;
				this.#props = slotProps(proxy({ ...this.#values }), available);
				hosts.set(this.#props, this);
				this.#stop = effectRoot(() => {
					this.#instance = mount(component, {
						target: shadows.get(this) ?? this,
						props: this.#props!,
						intro: false
					});
					template(() => {
						this.#reflecting = true;
						try {
							for (const [key, definition] of Object.entries(properties)) {
								if (!definition.reflect) continue;
								const value = this.#get(key);
								const text = toAttribute(value, definition.type);
								const name = definition.attribute ?? key;
								if (text === null) this.removeAttribute(name);
								else this.setAttribute(name, text);
							}
						} finally {
							this.#reflecting = false;
						}
					});
				});
			});
		}

		disconnectedCallback(): void {
			this.#connected = false;
			Promise.resolve().then(() => {
				if (this.#connected || this.#instance === null) return;
				untrack(() => {
					for (const [key, definition] of Object.entries(properties)) {
						if (definition.reflect) this.#values[key] = this.#get(key);
					}
				});
				unmount(this.#instance);
				this.#stop?.();
				this.#stop = null;
				this.#instance = null;
				this.#props = null;
			});
		}

		attributeChangedCallback(name: string, _before: string | null, value: string | null): void {
			if (this.#reflecting) return;
			const key = attributes.get(name);
			if (key !== undefined) this.#set(key, fromAttribute(value, properties[key]?.type));
		}

		#get(key: string): unknown {
			return this.#instance !== null && key in this.#instance
				? this.#instance[key]
				: this.#props !== null
					? this.#props[key]
					: this.#values[key];
		}

		#set(key: string, value: unknown): void {
			if (properties[key]?.type === 'Boolean' && typeof value !== 'boolean') value = value != null;
			this.#values[key] = value;
			if (this.#props !== null) this.#props[key] = value;
			if (this.#instance !== null && Object.getOwnPropertyDescriptor(this.#instance, key)?.set) {
				this.#instance[key] = value;
			}
		}

		static {
			for (const key of Object.keys(properties)) {
				Object.defineProperty(this.prototype, key, {
					get(this: Element) {
						return this.#get(key);
					},
					set(this: Element, value: unknown) {
						this.#set(key, value);
					}
				});
			}
			for (const key of exports) {
				Object.defineProperty(this.prototype, key, {
					get(this: Element) {
						return this.#instance?.[key];
					}
				});
			}
		}
	}
	const result = extend === undefined ? Element : extend(Element);
	component.element = result;
	return result;
}
