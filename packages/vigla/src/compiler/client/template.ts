import type * as ES from 'estree';
import { escapeContent } from '../../shared/escape.ts';
import {
	asyncStep,
	dynamic,
	hoisted,
	unsupported,
	type ComponentAnalysis
} from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type { Expression, Fragment, Namespace, Node, RawHtml, Text } from '../ir/nodes.ts';
import type { Host, Scoping } from '../css/index.ts';
import { asyncSetup, awaiting } from './asynchronous.ts';
import { blockCode } from './blocks.ts';
import {
	boundaryCall,
	componentCall,
	isDynamicComponent,
	isStaticRender,
	renderCall,
	snippetDeclarations
} from './component.ts';
import { constantDeclarations } from './constants.ts';
import { dynamicCall } from './dynamic.ts';
import { elementPart } from './element.ts';
import { rewrite, runtime, type Context } from './script.ts';

export interface TemplateContext extends Context {
	readonly component: ComponentAnalysis;
	readonly events: Set<string>;
	readonly groups: Map<string, ES.Identifier>;
	readonly instance: ES.Statement[];
	readonly scoping: Scoping;
}

export function scopeHash(context: TemplateContext, node: Host): string | null {
	const { hash, scoped } = context.scoping;
	return hash !== '' && scoped.has(node) ? hash : null;
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

export const HTML_CONTROLLED = 1;
const HTML_SVG = 2;
const HTML_MATHML = 4;
const HTML_UNCHECKED = 8;

export function htmlCall(
	context: TemplateContext,
	node: RawHtml,
	target: ES.Identifier,
	given: number
): ES.Statement {
	let flags = given;
	if (context.component.ignored.get(node)?.has('hydration_html_changed')) flags |= HTML_UNCHECKED;
	const args: ES.Expression[] = [target, b.arrow([], rewrite(context, node.expression))];
	if (flags !== 0) args.push(b.literal(flags));
	return b.statement(runtime(context, 'html', ...args));
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
		if (run.length > 0) {
			const pending = awaiting(context, run);
			result.push(
				pending.length > 0
					? anchorPart(asyncSetup(context, run, pending, namespace, render))
					: textPart(context, run)
			);
		}
		run = [];
	};
	for (const node of nodes) {
		if (node.kind === 'text' || node.kind === 'expression') {
			run.push(node);
			continue;
		}
		flush();
		const pending = node.kind === 'snippet' ? [] : awaiting(context, [node]);
		if (pending.length > 0) {
			result.push(anchorPart(asyncSetup(context, [node], pending, namespace, render)));
			continue;
		}
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
			case 'keyed-list':
			case 'unkeyed-list':
			case 'keyed-block':
			case 'async-block':
				result.push(
					anchorPart((anchor, emit) => emit.init.push(...blockCode(context, node, anchor)))
				);
				break;
			case 'component':
				result.push(
					anchorPart((anchor, emit) => emit.init.push(...componentCall(context, node, anchor)))
				);
				break;
			case 'render':
				result.push(
					anchorPart((anchor, emit) => emit.init.push(...renderCall(context, node, anchor)))
				);
				break;
			case 'boundary':
				result.push(
					anchorPart((anchor, emit) => emit.init.push(...boundaryCall(context, node, anchor)))
				);
				break;
			case 'dynamic-element':
				result.push(
					anchorPart((anchor, emit) => emit.init.push(...dynamicCall(context, node, anchor)))
				);
				break;
			case 'raw-html': {
				const flags = namespace === 'svg' ? HTML_SVG : namespace === 'mathml' ? HTML_MATHML : 0;
				result.push(
					anchorPart((anchor, emit) => emit.init.push(htmlCall(context, node, anchor, flags)))
				);
				break;
			}
			case 'snippet':
			case 'constant':
			case 'declaration':
				break;
			default:
				throw unsupported(node, `The ${node.kind} node`);
		}
	}
	flush();
	return result;
}

function withElementChildren(context: TemplateContext, nodes: readonly Node[]): Node[] {
	const result: Node[] = [];
	for (const node of nodes) {
		result.push(node);
		if (node.kind === 'element')
			result.push(...withElementChildren(context, cleaned(context, node.body)));
	}
	return result;
}

function standalone(context: TemplateContext, nodes: readonly Node[]): Node | null {
	const regular = nodes.filter((node) => !hoisted(node));
	if (regular.length !== 1) return null;
	const [only] = regular;
	if (only === undefined || awaiting(context, [only]).length > 0) return null;
	if (only?.kind === 'component' && !isDynamicComponent(context, only)) return only;
	if (only?.kind === 'render' && isStaticRender(context, only)) return only;
	return null;
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
	const step = asyncStep(nodes, context.awaited);
	const within = step === null ? withElementChildren(context, nodes) : step.before;
	const declarations = [
		...snippetDeclarations(context, within),
		...constantDeclarations(context, within, new Set(nodes))
	];
	const alone = step === null ? standalone(context, nodes) : null;
	if (alone?.kind === 'component')
		return [...declarations, ...componentCall(context, alone, anchor)];
	if (alone?.kind === 'render') return [...declarations, ...renderCall(context, alone, anchor)];
	const list =
		step === null
			? parts(context, nodes, namespace)
			: [anchorPart(asyncSetup(context, step.rest, step.pending, namespace, render))];
	if (list.length === 0) return declarations;
	const emit: Emit = { init: [...declarations], update: [], thunks: [], params: [] };
	const html = list.map((part) => part.html).join('');
	const startsWithText = textFirst && list[0]?.hint === 'text' && !isElement(list[0]);
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
