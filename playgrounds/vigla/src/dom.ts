type Child = Node | string;

export function h<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	props: Partial<HTMLElementTagNameMap[K]> = {},
	...children: Child[]
): HTMLElementTagNameMap[K] {
	const element = Object.assign(document.createElement(tag), props);
	element.append(...children);
	return element;
}

export function section(title: string, ...children: Child[]): HTMLElement {
	return h('section', {}, h('h2', {}, title), ...children);
}
