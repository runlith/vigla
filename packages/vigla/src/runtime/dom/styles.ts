import { effect } from '../reactivity/effects.ts';
import { owner } from '../reactivity/tracking.ts';
import { position } from './range.ts';

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
	const parent = owner;
	effect(() => {
		const target = container(position(parent) ?? anchor);
		if (target.querySelector(`#${style.hash}`) !== null) return;
		const element = document.createElement('style');
		element.id = style.hash;
		element.textContent = style.code;
		target.appendChild(element);
	});
}
