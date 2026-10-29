import type * as ES from 'estree';
import { escapeAttribute, escapeContent } from '../../shared/escape.ts';
import { isVoid } from '../../shared/html.ts';
import { unsupported, type ComponentAnalysis } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type {
	Branch,
	Element,
	Expression,
	Fragment,
	KeyedList,
	Node,
	Text,
	UnkeyedList
} from '../ir/nodes.ts';
import { rewrite, runtime, type Context } from './script.ts';

export interface TemplateContext extends Context {
	readonly component: ComponentAnalysis;
}

interface Dom {
	readonly html: string;
	readonly hint: string;
	readonly referenced: boolean;
	readonly children: readonly Dom[];
	readonly setup: ((node: ES.Identifier) => ES.Statement[]) | null;
}

function needed(dom: Dom): boolean {
	return dom.referenced || dom.children.some(needed);
}

function cleaned(context: TemplateContext, fragment: Fragment): readonly Node[] {
	const nodes = context.component.fragments.get(fragment);
	if (nodes === undefined) throw new Error('fragment was not analyzed');
	return nodes;
}

function textValue(context: TemplateContext, run: readonly (Text | Expression)[]): ES.Expression {
	const [only] = run;
	if (run.length === 1 && only?.kind === 'expression') return rewrite(context, only.expression);
	const quasis: string[] = [''];
	const expressions: ES.Expression[] = [];
	for (const part of run) {
		if (part.kind === 'text') {
			quasis[quasis.length - 1] += part.data;
		} else {
			expressions.push(b.logical('??', rewrite(context, part.expression), b.literal('')));
			quasis.push('');
		}
	}
	return b.template(quasis, expressions);
}

function textDom(context: TemplateContext, run: readonly (Text | Expression)[]): Dom {
	if (run.every((part) => part.kind === 'text')) {
		const data = run.map((part) => (part as Text).data).join('');
		return {
			html: escapeContent(data),
			hint: 'text',
			referenced: false,
			children: [],
			setup: null
		};
	}
	return {
		html: ' ',
		hint: 'text',
		referenced: true,
		children: [],
		setup: (node) => [
			b.statement(
				runtime(
					context,
					'template',
					b.arrow([], runtime(context, 'text', node, textValue(context, run)))
				)
			)
		]
	};
}

function handler(context: TemplateContext, expression: ES.Expression): ES.Expression {
	const value = rewrite(context, expression);
	if (value.type === 'ArrowFunctionExpression' || value.type === 'FunctionExpression') return value;
	const args = b.id(context.names.unique('args'));
	const callee: ES.MemberExpression = { ...b.member(value, 'apply'), optional: true };
	return {
		type: 'FunctionExpression',
		id: null,
		params: [{ type: 'RestElement', argument: args }],
		body: {
			type: 'BlockStatement',
			body: [
				{
					type: 'ReturnStatement',
					argument: {
						type: 'ChainExpression',
						expression: b.call(callee, { type: 'ThisExpression' }, args)
					}
				}
			]
		},
		async: false,
		generator: false
	};
}

function elementDom(context: TemplateContext, node: Element): Dom {
	let html = `<${node.name}`;
	const listeners: ((element: ES.Identifier) => ES.Statement)[] = [];
	for (const attribute of node.attributes) {
		if (attribute.kind !== 'attribute')
			throw unsupported(attribute, `The ${attribute.kind} directive`);
		const { value } = attribute;
		if (value.kind === 'boolean') {
			html += ` ${attribute.name}`;
		} else if (value.kind === 'text') {
			const text = value.parts.map((part) => (part as Text).data).join('');
			html += ` ${attribute.name}="${escapeAttribute(text)}"`;
		} else {
			const type = attribute.name.slice(2);
			const listener = value.expression;
			listeners.push((element) =>
				b.statement(runtime(context, 'on', element, b.literal(type), handler(context, listener)))
			);
		}
	}
	html += '>';
	const children = sequence(context, cleaned(context, node.body));
	for (const child of children) html += child.html;
	if (!isVoid(node.name)) html += `</${node.name}>`;
	return {
		html,
		hint: node.name,
		referenced: listeners.length > 0,
		children,
		setup: listeners.length > 0 ? (element) => listeners.map((listener) => listener(element)) : null
	};
}

function arm(context: TemplateContext, fragment: Fragment): ES.ArrowFunctionExpression {
	const anchor = b.id(context.names.unique('$$anchor'));
	return b.arrow([anchor], render(context, cleaned(context, fragment), anchor));
}

function branchCode(context: TemplateContext, node: Branch, anchor: ES.Identifier): ES.Statement[] {
	const statements: ES.Statement[] = [];
	const arms = node.arms.map((entry) => {
		const name = context.names.unique('arm');
		statements.push(b.constant(name, arm(context, entry.body)));
		return { test: rewrite(context, entry.test), name };
	});
	let select: ES.Expression = b.literal(null);
	if (node.fallback !== null) {
		const name = context.names.unique('fallback');
		statements.push(b.constant(name, arm(context, node.fallback)));
		select = b.id(name);
	}
	for (const entry of [...arms].reverse())
		select = b.conditional(entry.test, b.id(entry.name), select);
	statements.push(b.statement(runtime(context, 'branch', anchor, b.arrow([], select))));
	return statements;
}

function listCode(
	context: TemplateContext,
	node: KeyedList | UnkeyedList,
	anchor: ES.Identifier
): ES.Statement[] {
	const binding = context.component.items.get(node);
	if (binding === undefined) throw new Error('each block was not analyzed');
	const item = b.id(binding.name);
	const collection = b.arrow([], rewrite(context, node.collection));
	const key =
		node.kind === 'keyed-list'
			? b.arrow(
					[item],
					rewrite({ ...context, plain: new Set([...context.plain, binding]) }, node.key)
				)
			: b.literal(null);
	const row = b.id(context.names.unique('$$anchor'));
	const body = b.arrow([row, item], render(context, cleaned(context, node.body), row));
	return [b.statement(runtime(context, 'list', anchor, collection, key, body))];
}

function anchorDom(setup: (node: ES.Identifier) => ES.Statement[], hint: string): Dom {
	return { html: '<!>', hint, referenced: true, children: [], setup };
}

function sequence(context: TemplateContext, nodes: readonly Node[]): Dom[] {
	const doms: Dom[] = [];
	let run: (Text | Expression)[] = [];
	const flush = (): void => {
		if (run.length > 0) doms.push(textDom(context, run));
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
				doms.push(elementDom(context, node));
				break;
			case 'comment':
				doms.push({
					html: `<!--${node.data}-->`,
					hint: 'comment',
					referenced: false,
					children: [],
					setup: null
				});
				break;
			case 'branch':
				doms.push(anchorDom((anchor) => branchCode(context, node, anchor), 'node'));
				break;
			case 'keyed-list':
			case 'unkeyed-list':
				doms.push(anchorDom((anchor) => listCode(context, node, anchor), 'node'));
				break;
			default:
				throw unsupported(node, `The ${node.kind} node`);
		}
	}
	flush();
	return doms;
}

function navigate(
	context: TemplateContext,
	doms: readonly Dom[],
	parent: ES.Identifier,
	statements: ES.Statement[]
): void {
	let previous: ES.Identifier | null = null;
	let gap = 0;
	for (const dom of doms) {
		if (!needed(dom)) {
			gap++;
			continue;
		}
		const name = b.id(context.names.unique(dom.hint));
		let init: ES.Expression;
		if (previous === null) {
			const first = runtime(context, 'child', parent);
			init = gap === 0 ? first : runtime(context, 'sibling', first, b.literal(gap));
		} else {
			init =
				gap === 0
					? runtime(context, 'sibling', previous)
					: runtime(context, 'sibling', previous, b.literal(gap + 1));
		}
		statements.push(b.constant(name.name, init));
		previous = name;
		gap = 0;
		navigate(context, dom.children, name, statements);
		if (dom.setup !== null) statements.push(...dom.setup(name));
	}
}

export function render(
	context: TemplateContext,
	nodes: readonly Node[],
	anchor: ES.Identifier
): ES.Statement[] {
	const doms = sequence(context, nodes);
	if (doms.length === 0) return [];
	const template = context.names.unique('root');
	context.hoisted.push(
		b.constant(
			template,
			runtime(context, 'fragment', b.literal(doms.map((dom) => dom.html).join('')))
		)
	);
	const fragment = b.id(context.names.unique('fragment'));
	const statements: ES.Statement[] = [b.constant(fragment.name, b.call(b.id(template)))];
	navigate(context, doms, fragment, statements);
	statements.push(b.statement(runtime(context, 'append', anchor, fragment)));
	return statements;
}
