import type * as ES from 'estree';
import * as b from '../ir/estree.ts';
import type { Animation, Transition } from '../ir/nodes.ts';
import { rewrite, runtime } from './script.ts';
import type { TemplateContext } from './template.ts';

const IN = 1;
const OUT = 2;
const GLOBAL = 4;

export function transitionCall(
	context: TemplateContext,
	element: ES.Identifier,
	node: Transition
): ES.Statement {
	let flags = node.global ? GLOBAL : 0;
	if (node.direction !== 'out') flags |= IN;
	if (node.direction !== 'in') flags |= OUT;
	const args: ES.Expression[] = [
		b.literal(flags),
		element,
		b.arrow([], rewrite(context, node.transition))
	];
	if (node.argument !== null) args.push(b.arrow([], rewrite(context, node.argument)));
	return b.statement(runtime(context, 'transition', ...args));
}

export function animationCall(
	context: TemplateContext,
	element: ES.Identifier,
	node: Animation
): ES.Statement {
	const params =
		node.argument === null ? b.literal(null) : b.arrow([], rewrite(context, node.argument));
	return b.statement(
		runtime(context, 'animation', element, b.arrow([], rewrite(context, node.animation)), params)
	);
}
