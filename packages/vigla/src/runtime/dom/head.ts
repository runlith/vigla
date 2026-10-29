import { teardown } from '../reactivity/effects.ts';
import { claim, COMMENT, cursor, hydrating, setHydrating } from './hydration.ts';
import { build, discard, place, type Built } from './range.ts';
import type { Render } from './template.ts';

function marker(hash: string): ChildNode | null {
	let node = document.head.firstChild;
	while (node !== null && (node.nodeType !== COMMENT || (node as Comment).data !== hash)) {
		node = node.nextSibling;
	}
	return node;
}

function adopted(open: ChildNode, render: Render): { built: Built; anchor: ChildNode } {
	const start = open.nextSibling as ChildNode;
	open.remove();
	claim(start);
	const built = build(render);
	return { built, anchor: cursor };
}

function fresh(render: Render): { built: Built; anchor: ChildNode } {
	const anchor = document.head.appendChild(document.createTextNode(''));
	const built = build(render);
	place(built, anchor);
	return { built, anchor };
}

export function head(hash: string, render: Render): void {
	let shown: { built: Built; anchor: ChildNode };
	if (hydrating) {
		const previous = cursor;
		const open = marker(hash);
		if (open === null) {
			setHydrating(false);
			try {
				shown = fresh(render);
			} finally {
				setHydrating(true);
			}
		} else {
			shown = adopted(open, render);
		}
		claim(previous);
	} else {
		shown = fresh(render);
	}
	teardown(() => {
		discard(shown.built);
		shown.anchor.remove();
	});
}

export function title(value: string): void {
	document.title = value;
}
