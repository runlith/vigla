import type { Fragment, Node, Text } from '../ir/nodes.ts';

export interface Preserve {
	readonly whitespace: boolean;
	readonly comments: boolean;
}

const leading = /^[ \t\r\n]+/;
const trailing = /[ \t\r\n]+$/;
const visible = /[^ \t\r\n]/;

const removable = new Set([
	'select',
	'tr',
	'table',
	'tbody',
	'thead',
	'tfoot',
	'colgroup',
	'datalist'
]);

export const preserving: ReadonlySet<string> = new Set(['pre', 'textarea']);

function text(node: Text, data: string): Text {
	return data === node.data ? node : { ...node, data };
}

function dropPreNewline(nodes: Node[], parent: string | null): Node[] {
	const [first] = nodes;
	if (
		parent === 'pre' &&
		first?.kind === 'text' &&
		(first.data === '\n' || first.data === '\r\n')
	) {
		return nodes.slice(1);
	}
	return nodes;
}

export function clean(
	fragment: Fragment,
	parent: string | null,
	preserve: Preserve,
	foreign = false
): Node[] {
	const nodes = fragment.nodes.filter((node) => node.kind !== 'comment' || preserve.comments);
	if (preserve.whitespace) return dropPreNewline(nodes, parent);

	let start = 0;
	let end = nodes.length;
	while (start < end && isBlank(nodes[start])) start++;
	while (end > start && isBlank(nodes[end - 1])) end--;
	const kept = nodes.slice(start, end);

	const first = kept[0];
	if (first?.kind === 'text') kept[0] = text(first, first.data.replace(leading, ''));
	const lastIndex = kept.length - 1;
	const last = kept[lastIndex];
	if (last?.kind === 'text') kept[lastIndex] = text(last, last.data.replace(trailing, ''));

	const result: Node[] = [];
	for (let index = 0; index < kept.length; index++) {
		const node = kept[index] as Node;
		if (node.kind !== 'text') {
			result.push(node);
			continue;
		}
		const previous = kept[index - 1];
		const next = kept[index + 1];
		let data = node.data;
		if (previous?.kind !== 'expression') {
			const joined = previous?.kind === 'text' && trailing.test(previous.data);
			data = data.replace(leading, joined ? '' : ' ');
		}
		if (next?.kind !== 'expression') data = data.replace(trailing, ' ');
		if (data === '' || (data === ' ' && (foreign || (parent !== null && removable.has(parent))))) {
			continue;
		}
		result.push(text(node, data));
	}
	return result;
}

function isBlank(node: Node | undefined): boolean {
	return node?.kind === 'text' && !visible.test(node.data);
}
