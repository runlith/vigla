import { effect } from '../reactivity/effects.ts';

export interface Style {
	readonly hash: string;
	readonly code: string;
}

function container(anchor: Node): ParentNode & Node {
	const root = anchor.getRootNode();
	if ((root as ShadowRoot).host) return root as ShadowRoot;
	return (root as Document).head ?? (anchor.ownerDocument ?? document).head;
}

export function appendStyles(anchor: Node, style: Style): void {
	effect(() => {
		const target = container(anchor);
		if (target.querySelector(`#${style.hash}`) !== null) return;
		const element = document.createElement('style');
		element.id = style.hash;
		element.textContent = style.code;
		target.appendChild(element);
	});
}
