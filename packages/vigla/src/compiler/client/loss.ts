import type * as ES from 'estree';
import { spanOf } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type { Ignores } from '../ir/port.ts';
import type { Span } from '../ir/nodes.ts';
import { runtime, type Context } from './script.ts';

type Function = ES.FunctionDeclaration | ES.FunctionExpression | ES.ArrowFunctionExpression;

export interface Losses {
	readonly ignored: readonly Span[];
	readonly inside: boolean;
}

export function losses(...sources: Ignores[]): Losses {
	const ignored: Span[] = [];
	for (const ignores of sources)
		for (const [node, codes] of ignores)
			if (codes.has('await_reactivity_loss')) ignored.push(spanOf(node as ES.Node));
	return { ignored, inside: false };
}

export function lossScope(context: Context, node: Function): Context {
	const found = context.losses;
	if (found === undefined || found.inside || !node.async) return context;
	return { ...context, losses: { ...found, inside: true } };
}

function ignored(found: Losses, node: ES.Node): boolean {
	const span = spanOf(node);
	return found.ignored.some((at) => at.start <= span.start && at.end >= span.end);
}

export function checkLoss(
	context: Context,
	node: ES.Node,
	next: <T extends ES.Node>(node: T) => T
): ES.Node | undefined {
	const found = context.losses;
	if (found === undefined || !found.inside) return undefined;
	if (node.type === 'AwaitExpression' && !ignored(found, node)) {
		return b.call({ ...node, argument: runtime(context, 'trackLoss', next(node.argument)) });
	}
	if (node.type === 'ForOfStatement' && node.await && !ignored(found, node)) {
		return {
			...node,
			left: next(node.left),
			right: runtime(context, 'trackLossEach', next(node.right)),
			body: next(node.body)
		};
	}
	return undefined;
}
