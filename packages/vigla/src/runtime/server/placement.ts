import { invalidIn, invalidUnder } from '../../shared/nesting.ts';
import type { Output } from './render.ts';

export interface Placed {
	readonly tag: string;
	readonly parent: Placed | null;
	readonly at: string;
}

const reported = new WeakMap<object, Set<string>>();

function report(out: Output, message: string): void {
	const text = `node_invalid_placement_ssr: ${message}\n\nThis can cause content to shift around as the browser repairs the HTML, and will likely result in a \`hydration_mismatch\` warning.`;
	let seen = reported.get(out.global);
	if (seen === undefined) reported.set(out.global, (seen = new Set()));
	if (seen.has(text)) return;
	seen.add(text);
	console.error(text);
	const script = JSON.stringify(text).replaceAll('</', '<\\u002f');
	out.head((head) => head.push(`<script>console.error(${script})</script>`));
}

export function pushElement(
	out: Output,
	tag: string,
	file: string,
	line: number,
	column: number
): void {
	const parent = out.element;
	const at = `${file}:${line}:${column}`;
	if (parent !== null) {
		const message = invalidIn(tag, parent.tag, at, parent.at);
		if (message !== null) report(out, message);
		const ancestors = [parent.tag];
		for (let ancestor = parent.parent; ancestor !== null; ancestor = ancestor.parent) {
			ancestors.push(ancestor.tag);
			const found = invalidUnder(tag, ancestors, at, ancestor.at);
			if (found !== null) report(out, found);
		}
	}
	out.element = { tag, parent, at };
}

export function popElement(out: Output): void {
	out.element = out.element?.parent ?? null;
}
