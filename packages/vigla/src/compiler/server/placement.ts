import type * as ES from 'estree';
import * as b from '../ir/estree.ts';
import type { ComponentUnit } from '../ir/port.ts';
import type { Element } from '../ir/nodes.ts';
import { runtime } from './script.ts';
import type { Buffer, TemplateContext } from './template.ts';

const lines = new WeakMap<ComponentUnit, number[]>();

function position(unit: ComponentUnit, offset: number): [number, number] {
	let starts = lines.get(unit);
	if (starts === undefined) {
		starts = [0];
		for (let index = 0; index < unit.source.length; index++)
			if (unit.source[index] === '\n') starts.push(index + 1);
		lines.set(unit, starts);
	}
	let low = 0;
	let high = starts.length;
	while (low + 1 < high) {
		const middle = (low + high) >>> 1;
		if ((starts[middle] as number) <= offset) low = middle;
		else high = middle;
	}
	return [low + 1, offset - (starts[low] as number)];
}

export function placed(
	context: TemplateContext,
	node: Element,
	statements: ES.Statement[],
	buffer: Buffer,
	emit: () => void
): void {
	if (!context.dev) {
		emit();
		return;
	}
	const unit = context.component.unit;
	const [line, column] = position(unit, node.start);
	buffer.flush(context, statements);
	statements.push(
		b.statement(
			runtime(
				context,
				'pushElement',
				context.out,
				b.literal(node.name),
				b.literal(context.filename ?? '(unknown)'),
				b.literal(line),
				b.literal(column)
			)
		)
	);
	emit();
	buffer.flush(context, statements);
	statements.push(b.statement(runtime(context, 'popElement', context.out)));
}
