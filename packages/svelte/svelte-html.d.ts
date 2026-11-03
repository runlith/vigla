/// <reference lib="dom" />

import type * as elements from './elements.js';

type Known<T> = keyof {
	[K in keyof T as string extends K ? never : number extends K ? never : K]: 0;
};

type Tag = Known<elements.SvelteHTMLElements>;

type HTMLProps<K extends Tag, Extra> = Omit<elements.SvelteHTMLElements[K], keyof Extra> & Extra;

type ElementOf<Key> = Key extends keyof ElementTagNameMap
	? ElementTagNameMap[Key]
	: Key extends keyof SVGElementTagNameMap
		? SVGElementTagNameMap[Key]
		: any;

type AttributesOf<Elements, Key extends keyof Elements> = string extends Key
	? elements.HTMLAttributes<any>
	: Elements[Key];

declare global {
	namespace svelteHTML {
		function mapElementTag<K extends keyof ElementTagNameMap>(tag: K): ElementTagNameMap[K];
		function mapElementTag<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K];
		function mapElementTag(tag: any): any;

		function createElement<Elements extends IntrinsicElements, Key extends keyof Elements>(
			element: Key | undefined | null,
			attrs: AttributesOf<Elements, Key>
		): ElementOf<Key>;
		function createElement<Elements extends IntrinsicElements, Key extends keyof Elements, T>(
			element: Key | undefined | null,
			attrsEnhancers: T,
			attrs: AttributesOf<Elements, Key> & T
		): ElementOf<Key>;

		interface HTMLAttributes<T extends EventTarget = any> {}

		interface SVGAttributes<T extends EventTarget = any> {}

		type Augmented = {
			[K in Tag]: K extends Exclude<keyof SVGElementTagNameMap, keyof HTMLElementTagNameMap>
				? HTMLProps<K, SVGAttributes>
				: HTMLProps<K, HTMLAttributes>;
		};

		interface IntrinsicElements extends Augmented {
			[name: string]: { [name: string]: any };
		}
	}
}
