import { armIndex } from '../../shared/markers.ts';
import { block } from '../reactivity/effects.ts';
import { Branches, COMMENTED } from './branches.ts';
import { hydrating, instruction } from './hydration.ts';
import type { Render } from './template.ts';

export function branch(
	node: ChildNode,
	select: () => number,
	arms: readonly Render[],
	fallback: Render | null
): void {
	const branches = new Branches<number>(node);
	let first = true;
	block(() => {
		const index = select();
		const arm = index === -1 ? fallback : (arms[index] ?? null);
		if (!first) {
			branches.show(index, () => arm);
			return;
		}
		first = false;
		branches.start(index, arm, hydrating ? armIndex(instruction(node)) === index : null);
	});
}

export function key(node: ChildNode, value: () => unknown, render: Render): void {
	const branches = new Branches<unknown>(node);
	let first = true;
	block(() => {
		const current = value();
		if (!first) {
			branches.show(current, () => render);
			return;
		}
		first = false;
		branches.start(current, render, hydrating ? true : null, COMMENTED);
	});
}
