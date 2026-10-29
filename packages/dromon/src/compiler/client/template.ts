import type * as ES from 'estree';
import { escapeContent } from '../../shared/escape.ts';
import { dynamic, unsupported, type ComponentAnalysis } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type {
	Branch,
	Expression,
	Fragment,
	KeyedList,
	Namespace,
	Node,
	Text,
	UnkeyedList
} from '../ir/nodes.ts';
import { elementPart } from './element.ts';
import { rewrite, runtime, type Context } from './script.ts';

export interface TemplateContext extends Context {
	readonly component: ComponentAnalysis;
	readonly events: Set<string>;
}

export interface Emit {
	readonly init: ES.Statement[];
	readonly update: ES.Statement[];
	readonly thunks: ES.Expression[];
	readonly params: ES.Identifier[];
}

export interface Part {
	readonly html: string;
	readonly hint: string;
	readonly text: boolean;
	readonly referenced: boolean;
	readonly children: readonly Part[];
	readonly setup: ((node: ES.Identifier, emit: Emit) => void) | null;
}

export const SINGLE = 1;
export const SVG = 2;
export const MATHML = 4;

function needed(part: Part): boolean {
	return part.referenced || part.children.some(needed);
}

export function cleaned(context: TemplateContext, fragment: Fragment): readonly Node[] {
	const nodes = context.component.fragments.get(fragment);
	if (nodes === undefined) throw new Error('fragment was not analyzed');
	return nodes;
}

function hasCall(expression: ES.Node): boolean {
	let found = false;
	b.walk(expression, (node) => {
		if (found) return false;
		if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') return false;
		if (node.type === 'CallExpression' || node.type === 'NewExpression') {
			found = true;
			return false;
		}
	});
	return found;
}

export function memo(
	context: TemplateContext,
	emit: Emit,
	source: ES.Expression,
	value: ES.Expression
): ES.Expression {
	if (!hasCall(source)) return value;
	const param = b.id(context.names.unique('$value'));
	emit.thunks.push(b.arrow([], value));
	emit.params.push(param);
	return param;
}

export function isDynamic(context: TemplateContext, expression: ES.Node): boolean {
	return dynamic(context.component, expression);
}

function textValue(
	context: TemplateContext,
	emit: Emit,
	run: readonly (Text | Expression)[]
): ES.Expression {
	const [only] = run;
	if (run.length === 1 && only?.kind === 'expression') {
		return memo(context, emit, only.expression, rewrite(context, only.expression));
	}
	const quasis: string[] = [''];
	const expressions: ES.Expression[] = [];
	for (const part of run) {
		if (part.kind === 'text') {
			quasis[quasis.length - 1] += part.data;
		} else {
			const value = memo(context, emit, part.expression, rewrite(context, part.expression));
			expressions.push(b.logical('??', value, b.literal('')));
			quasis.push('');
		}
	}
	return b.template(quasis, expressions);
}

function textPart(context: TemplateContext, run: readonly (Text | Expression)[]): Part {
	if (run.every((part) => part.kind === 'text')) {
		const data = run.map((part) => (part as Text).data).join('');
		return {
			html: escapeContent(data),
			hint: 'text',
			text: false,
			referenced: false,
			children: [],
			setup: null
		};
	}
	const reactive = run.some(
		(part) => part.kind === 'expression' && isDynamic(context, part.expression)
	);
	const empty = run.every((part) => part.kind === 'expression' || part.data === '');
	return {
		html: ' ',
		hint: 'text',
		text: empty,
		referenced: true,
		children: [],
		setup: (node, emit) => {
			if (reactive) {
				emit.update.push(
					b.statement(runtime(context, 'text', node, textValue(context, emit, run)))
				);
			} else {
				const value = textValue(context, { init: [], update: [], thunks: [], params: [] }, run);
				emit.init.push(b.statement(runtime(context, 'text', node, value)));
			}
		}
	};
}

function arm(
	context: TemplateContext,
	fragment: Fragment,
	textFirst: boolean,
	params: readonly ES.Pattern[] = []
): ES.ArrowFunctionExpression {
	const anchor = b.id(context.names.unique('$$anchor'));
	const namespace = context.component.fragmentNamespaces.get(fragment) ?? 'html';
	return b.arrow(
		[anchor, ...params],
		render(context, cleaned(context, fragment), anchor, namespace, textFirst)
	);
}

function branchCode(context: TemplateContext, node: Branch, anchor: ES.Identifier): ES.Statement[] {
	const statements: ES.Statement[] = [];
	const arms = node.arms.map((entry) => {
		const name = context.names.unique('arm');
		statements.push(b.constant(name, arm(context, entry.body, false)));
		return b.id(name);
	});
	let fallback: ES.Expression = b.literal(null);
	if (node.fallback !== null) {
		const name = context.names.unique('fallback');
		statements.push(b.constant(name, arm(context, node.fallback, false)));
		fallback = b.id(name);
	}
	let select: ES.Expression = b.literal(-1);
	for (let index = node.arms.length - 1; index >= 0; index--) {
		const entry = node.arms[index] as (typeof node.arms)[number];
		select = b.conditional(rewrite(context, entry.test), b.literal(index), select);
	}
	statements.push(
		b.statement(
			runtime(
				context,
				'branch',
				anchor,
				b.arrow([], select),
				{ type: 'ArrayExpression', elements: arms },
				fallback
			)
		)
	);
	return statements;
}

function listCode(
	context: TemplateContext,
	node: KeyedList | UnkeyedList,
	anchor: ES.Identifier
): ES.Statement[] {
	const facts = context.component.lists.get(node);
	if (facts === undefined) throw new Error('each block was not analyzed');
	const item = b.id(facts.item.name);
	const index = b.id(facts.index?.name ?? context.names.unique('$$index'));
	const collection = b.arrow([], rewrite(context, node.collection));
	const plain = new Set([...context.plain, facts.item]);
	if (facts.index !== null) plain.add(facts.index);
	const key =
		node.kind === 'keyed-list'
			? b.arrow([item, index], rewrite({ ...context, plain }, node.key))
			: b.literal(null);
	const statements: ES.Statement[] = [];
	const body = arm(context, node.body, true, [item, index]);
	const args: ES.Expression[] = [anchor, collection, key, body];
	if (node.fallback !== null) args.push(arm(context, node.fallback, true));
	statements.push(b.statement(runtime(context, 'list', ...args)));
	return statements;
}

function anchorPart(setup: (node: ES.Identifier, emit: Emit) => void): Part {
	return { html: '<!>', hint: 'node', text: false, referenced: true, children: [], setup };
}

export function parts(
	context: TemplateContext,
	nodes: readonly Node[],
	namespace: Namespace
): Part[] {
	const result: Part[] = [];
	let run: (Text | Expression)[] = [];
	const flush = (): void => {
		if (run.length > 0) result.push(textPart(context, run));
		run = [];
	};
	for (const node of nodes) {
		if (node.kind === 'text' || node.kind === 'expression') {
			run.push(node);
			continue;
		}
		flush();
		switch (node.kind) {
			case 'element':
				result.push(elementPart(context, node, namespace));
				break;
			case 'comment':
				result.push({
					html: `<!--${node.data}-->`,
					hint: 'comment',
					text: false,
					referenced: false,
					children: [],
					setup: null
				});
				break;
			case 'branch':
				result.push(
					anchorPart((anchor, emit) => emit.init.push(...branchCode(context, node, anchor)))
				);
				break;
			case 'keyed-list':
			case 'unkeyed-list':
				result.push(
					anchorPart((anchor, emit) => emit.init.push(...listCode(context, node, anchor)))
				);
				break;
			default:
				throw unsupported(node, `The ${node.kind} node`);
		}
	}
	flush();
	return result;
}

export function navigate(
	context: TemplateContext,
	list: readonly Part[],
	initial: (text: boolean) => ES.Expression,
	emit: Emit
): boolean {
	let previous = initial;
	let skipped = 0;
	let moved = false;
	for (const part of list) {
		if (!needed(part)) {
			skipped++;
			continue;
		}
		const from = previous;
		const expression =
			skipped === 0
				? from(part.text)
				: runtime(
						context,
						'sibling',
						from(false),
						...(part.text || skipped !== 1 ? [b.literal(skipped)] : []),
						...(part.text ? [b.literal(true)] : [])
					);
		let id: ES.Identifier;
		if (expression.type === 'Identifier') {
			id = expression;
		} else {
			id = b.id(context.names.unique(part.hint.replace(/[^\w$]/g, '_')));
			emit.init.push(b.constant(id.name, expression));
		}
		moved = true;
		previous = () => id;
		skipped = 1;
		if (part.children.some(needed)) {
			const node = id;
			const descended = navigate(
				context,
				part.children,
				(text) => runtime(context, 'child', node, ...(text ? [b.literal(true)] : [])),
				emit
			);
			if (descended) emit.init.push(b.statement(runtime(context, 'reset', node)));
		}
		part.setup?.(id, emit);
	}
	if (skipped > 1) {
		emit.init.push(
			b.statement(runtime(context, 'next', ...(skipped - 1 !== 1 ? [b.literal(skipped - 1)] : [])))
		);
	}
	return moved;
}

export function flush(context: TemplateContext, emit: Emit): ES.Statement[] {
	if (emit.update.length === 0) return emit.init;
	const fn = b.arrow(emit.params, emit.update);
	const args: ES.Expression[] = [fn];
	if (emit.thunks.length > 0) args.push({ type: 'ArrayExpression', elements: emit.thunks });
	return [...emit.init, b.statement(runtime(context, 'content', ...args))];
}

function flags(namespace: Namespace, single: boolean): number {
	let result = single ? SINGLE : 0;
	if (namespace === 'svg') result |= SVG;
	if (namespace === 'mathml') result |= MATHML;
	return result;
}

function isElement(part: Part | undefined): boolean {
	return part !== undefined && part.html.startsWith('<') && !part.html.startsWith('<!');
}

export function render(
	context: TemplateContext,
	nodes: readonly Node[],
	anchor: ES.Identifier,
	namespace: Namespace,
	textFirst: boolean
): ES.Statement[] {
	const list = parts(context, nodes, namespace);
	if (list.length === 0) return [];
	const emit: Emit = { init: [], update: [], thunks: [], params: [] };
	const html = list.map((part) => part.html).join('');
	const startsWithText = textFirst && list[0]?.hint === 'text';
	if (startsWithText) emit.init.push(b.statement(runtime(context, 'next')));
	const [head] = list;
	const single = list.length === 1 && isElement(head);
	const template = context.names.unique('root');
	const flagged = flags(namespace, single);
	const args: ES.Expression[] = [b.literal(html)];
	if (flagged !== 0) args.push(b.literal(flagged));
	context.hoisted.push(b.constant(template, runtime(context, 'fragment', ...args)));
	const hint = single && head !== undefined ? head.hint.replace(/[^\w$]/g, '_') : 'fragment';
	const root = b.id(context.names.unique(hint));
	emit.init.push(b.constant(root.name, b.call(b.id(template))));
	if (single) {
		navigate(context, list, () => root, emit);
	} else {
		navigate(
			context,
			list,
			(text) => runtime(context, 'first', root, ...(text ? [b.literal(true)] : [])),
			emit
		);
	}
	return [...flush(context, emit), b.statement(runtime(context, 'append', anchor, root))];
}
