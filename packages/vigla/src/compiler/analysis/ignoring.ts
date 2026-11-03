import type * as ES from 'estree';
import type { Span } from '../ir/nodes.ts';
import type { Ignores } from '../ir/port.ts';
import { spanOf } from './scope.ts';

export type Ignoring = (node: ES.Node, code: string) => boolean;

export function ignoring(...sources: Ignores[]): Ignoring {
	const spans = new Map<string, Span[]>();
	for (const ignores of sources)
		for (const [node, codes] of ignores) {
			const span = spanOf(node as ES.Node);
			for (const code of codes) {
				const found = spans.get(code);
				if (found === undefined) spans.set(code, [span]);
				else found.push(span);
			}
		}
	return (node, code) => {
		const found = spans.get(code);
		if (found === undefined) return false;
		const span = spanOf(node);
		return found.some((at) => at.start <= span.start && at.end >= span.end);
	};
}
