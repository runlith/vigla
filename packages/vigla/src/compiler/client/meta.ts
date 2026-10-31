import type * as ES from 'estree';
import * as b from '../ir/estree.ts';
import type { Span } from '../ir/nodes.ts';
import { runtime } from './script.ts';
import type { TemplateContext } from './template.ts';

export class Positions {
	readonly #lines = [0];
	readonly #file: string;

	constructor(source: string, file: string) {
		this.#file = file;
		for (let index = 0; index < source.length; index++) {
			if (source[index] === '\n') this.#lines.push(index + 1);
		}
	}

	at(offset: number): Record<string, ES.Expression> {
		let low = 0;
		let high = this.#lines.length;
		while (low + 1 < high) {
			const middle = (low + high) >>> 1;
			if ((this.#lines[middle] as number) <= offset) low = middle;
			else high = middle;
		}
		return {
			file: b.literal(this.#file),
			line: b.literal(low + 1),
			column: b.literal(offset - (this.#lines[low] as number))
		};
	}
}

export function location(
	context: TemplateContext,
	node: Span,
	target: ES.Expression
): ES.Statement[] {
	return context.dev
		? [
				b.statement(
					runtime(
						context,
						'locate',
						target,
						b.literal(context.format.meta),
						b.object(context.positions.at(node.start))
					)
				)
			]
		: [];
}

export function scoped(
	context: TemplateContext,
	node: Span,
	type: string,
	body: ES.Statement[],
	extra: Record<string, ES.Expression> = {}
): ES.Statement[] {
	if (!context.dev) return body;
	const source = b.object({ ...context.positions.at(node.start), type: b.literal(type), ...extra });
	return [b.statement(runtime(context, 'frame', source, b.arrow([], body)))];
}
