import type * as ES from 'estree';
import type { Format } from '../../shared/format.ts';
import { escapeContent } from '../../shared/escape.ts';
import {
	asyncStep,
	dynamic,
	hoisted,
	richSelect,
	unsupported,
	type AsyncStep,
	type ComponentAnalysis
} from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type { Expression, Fragment, Namespace, Node, RawHtml, Text } from '../ir/nodes.ts';
import type { Host, Scoping } from '../css/index.ts';
import { asyncSetup, awaiting } from './asynchronous.ts';
import { blockCode } from './blocks.ts';
import type { GroupKey } from './bindings.ts';
import {
	boundaryCall,
	componentCall,
	isDynamicComponent,
	isStaticRender,
	renderCall,
	snippetDeclarations,
	styledComponent
} from './component.ts';
import { constantDeclarations } from './constants.ts';
import { dynamicCall } from './dynamic.ts';
import { slotCall } from './custom-element.ts';
import { elementPart } from './element.ts';
import type { Positions } from './meta.ts';
import { rewrite, runtime, type Context } from './script.ts';

export interface TemplateContext extends Context {
	readonly component: ComponentAnalysis;
	readonly events: Set<string>;
	readonly groups: Map<GroupKey, ES.Identifier>;
	readonly instance: ES.Statement[];
	readonly early: ES.Statement[];
	readonly moduleSetup: ES.Statement[];
	readonly scoping: Scoping;
	readonly format: Format;
	readonly positions: Positions;
	readonly boundContent?: boolean;
	readonly structural?: boolean;
	readonly externalRows?: boolean;
}

export function scopeHash(context: TemplateContext, node: Host): string | null {
	const { hash, scoped } = context.scoping;
	return hash !== '' && scoped.has(node) ? hash : null;
}

export interface Emit {
	readonly init: ES.Statement[];
	readonly after: ES.Statement[];
	readonly update: ES.Statement[];
	readonly thunks: ES.Expression[];
	readonly params: ES.Identifier[];
	content?: ES.Statement[];
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
export const SCRIPTS = 8;

function needed(part: Part): boolean {
	return part.referenced || part.children.some(needed);
}

export function cleaned(context: TemplateContext, fragment: Fragment): readonly Node[] {
	const nodes = context.component.fragments.get(fragment);
	if (nodes === undefined) throw new Error('fragment was not analyzed');
	return nodes;
}

export function hasCall(expression: ES.Node): boolean {
	let found = false;
	b.walk(expression, (node) => {
		if (found) return false;
		if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') return false;
		if (
			node.type === 'CallExpression' ||
			node.type === 'NewExpression' ||
			node.type === 'TaggedTemplateExpression'
		) {
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
	const read = (expression: ES.Expression): ES.Expression => {
		const value = rewrite(context, expression);
		return context.boundContent ? value : memo(context, emit, expression, value);
	};
	const [only] = run;
	if (run.length === 1 && only?.kind === 'expression') return read(only.expression);
	const quasis: string[] = [''];
	const expressions: ES.Expression[] = [];
	for (const part of run) {
		if (part.kind === 'text') {
			quasis[quasis.length - 1] += part.data;
		} else {
			const value = read(part.expression);
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
	const reactive =
		!context.boundContent &&
		run.some((part) => part.kind === 'expression' && isDynamic(context, part.expression));
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
				const value = textValue(
					context,
					{ init: [], after: [], update: [], thunks: [], params: [] },
					run
				);
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
	return { html: '<!---->', hint: 'node', text: false, referenced: true, children: [], setup };
}

export function parts(
	context: TemplateContext,
	nodes: readonly Node[],
	namespace: Namespace,
	step: AsyncStep | null = asyncStep(nodes, context.awaited)
): Part[] {
	if (step !== null)
		return [anchorPart(asyncSetup(context, step.rest, step.pending, namespace, render))];
	const result: Part[] = [];
	let run: (Text | Expression)[] = [];
	const flush = (): void => {
		if (run.length > 0) {
			const pending = awaiting(context, run);
			result.push(
				pending.length > 0
					? anchorPart(asyncSetup(context, run, pending, namespace, render, 'content'))
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
		const pending =
			node.kind === 'snippet' || node.kind === 'async-block' ? [] : awaiting(context, [node]);
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
					styledComponent(context, node, namespace === 'svg') ??
						anchorPart((anchor, emit) => emit.init.push(...componentCall(context, node, anchor)))
				);
				break;
			case 'slot':
				result.push(anchorPart((anchor, emit) => emit.init.push(slotCall(context, node, anchor))));
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
			case 'debug':
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
		if (node.kind === 'element') {
			if ((context.component.namespaces.get(node) ?? 'html') === 'html' && richSelect(node))
				continue;
			const body = cleaned(context, node.body);
			result.push(
				...withElementChildren(context, asyncStep(body, context.awaited)?.before ?? body)
			);
		}
	}
	return result;
}

function standalone(context: TemplateContext, nodes: readonly Node[]): Node | null {
	const regular = nodes.filter((node) => !hoisted(node));
	if (regular.length !== 1) return null;
	const [only] = regular;
	if (only === undefined || awaiting(context, [only]).length > 0) return null;
	if (
		only?.kind === 'component' &&
		!isDynamicComponent(context, only) &&
		!only.attributes.some(
			(attribute) => attribute.kind === 'attribute' && attribute.name.startsWith('--')
		)
	)
		return only;
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
	const content = emit.content ?? [];
	if (emit.update.length === 0)
		return content.length === 0 && emit.after.length === 0
			? emit.init
			: [...emit.init, ...content, ...emit.after];
	const fn = b.arrow(emit.params, emit.update);
	const args: ES.Expression[] = [fn];
	if (emit.thunks.length > 0) args.push({ type: 'ArrayExpression', elements: emit.thunks });
	return [
		...emit.init,
		...content,
		b.statement(runtime(context, 'content', ...args)),
		...emit.after
	];
}

function hasScript(part: Part): boolean {
	return part.hint.toLowerCase() === 'script' || part.children.some(hasScript);
}

function flags(namespace: Namespace, single: boolean, scripts: boolean): number {
	let result = single ? SINGLE : 0;
	if (namespace === 'svg') result |= SVG;
	if (namespace === 'mathml') result |= MATHML;
	if (scripts) result |= SCRIPTS;
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
	if (context.dev) {
		for (const node of within) {
			if (node.kind !== 'debug') continue;
			const values = b.object(
				Object.fromEntries(
					node.identifiers.map((id) => [
						id.name,
						runtime(context, 'snapshot', rewrite(context, id))
					])
				)
			);
			declarations.push(
				b.statement(
					runtime(
						context,
						'content',
						b.arrow(
							[],
							[
								b.statement(b.call(b.member(b.id('console'), 'log'), values)),
								{ type: 'DebuggerStatement' }
							]
						)
					)
				)
			);
		}
	}
	const alone = step === null ? standalone(context, nodes) : null;
	if (alone?.kind === 'component')
		return [...declarations, ...componentCall(context, alone, anchor)];
	if (alone?.kind === 'render') return [...declarations, ...renderCall(context, alone, anchor)];
	const list = parts(context, nodes, namespace, step);
	if (list.length === 0) return declarations;
	const emit: Emit = { init: [...declarations], after: [], update: [], thunks: [], params: [] };
	const html = list.map((part) => part.html).join('');
	const startsWithText = textFirst && list[0]?.hint === 'text' && !isElement(list[0]);
	if (startsWithText) emit.init.push(b.statement(runtime(context, 'next')));
	const [head] = list;
	const single = list.length === 1 && isElement(head);
	const template = context.names.unique('root');
	const flagged = flags(namespace, single, list.some(hasScript));
	const args: ES.Expression[] = [b.template([html], [])];
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
