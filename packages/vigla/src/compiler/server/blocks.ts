import type * as ES from 'estree';
import { arm, close, empty, fallback, open, openElse } from '../../shared/markers.ts';
import * as b from '../ir/estree.ts';
import type {
	AsyncBlock,
	Branch,
	Fragment,
	KeyedBlock,
	KeyedList,
	UnkeyedList
} from '../ir/nodes.ts';
import { rewrite, runtime } from './script.ts';
import { Buffer, cleaned, fragmentCode, type TemplateContext } from './template.ts';

export type Block = Branch | KeyedList | UnkeyedList | KeyedBlock | AsyncBlock;

export function section(
	context: TemplateContext,
	marker: string,
	fragment: Fragment | null,
	textFirst: boolean
): ES.BlockStatement {
	const statements: ES.Statement[] = [];
	const buffer = new Buffer();
	buffer.text(marker);
	if (fragment !== null)
		fragmentCode(context, cleaned(context, fragment), statements, buffer, textFirst);
	buffer.flush(context, statements);
	return { type: 'BlockStatement', body: statements };
}

function branch(context: TemplateContext, node: Branch, statements: ES.Statement[]): void {
	let chain: ES.Statement = section(context, arm(fallback), node.fallback, false);
	for (let index = node.arms.length - 1; index >= 0; index--) {
		const entry = node.arms[index];
		if (entry === undefined) continue;
		chain = {
			type: 'IfStatement',
			test: rewrite(context, entry.test),
			consequent: section(context, arm(index), entry.body, false),
			alternate: chain
		};
	}
	statements.push(chain);
}

function list(
	context: TemplateContext,
	node: KeyedList | UnkeyedList,
	statements: ES.Statement[]
): void {
	const facts = context.component.lists.get(node);
	if (facts === undefined) throw new Error('each block was not analyzed');
	const items = b.id(context.names.unique('each_array'));
	const index = b.id(facts.index?.name ?? context.names.unique('$$index'));
	const length = b.id(context.names.unique('$$length'));
	statements.push(
		b.constant(items.name, runtime(context, 'iterate', rewrite(context, node.collection)))
	);
	const body = section(context, '', node.body, true);
	const current: ES.MemberExpression = {
		type: 'MemberExpression',
		object: items,
		property: index,
		computed: true,
		optional: false
	};
	const item: ES.Statement[] =
		node.item === null
			? []
			: [
					{
						type: 'VariableDeclaration',
						kind: 'const',
						declarations: [
							{ type: 'VariableDeclarator', id: rewrite(context, node.item), init: current }
						]
					}
				];
	const loop: ES.ForStatement = {
		type: 'ForStatement',
		init: {
			type: 'VariableDeclaration',
			kind: 'let',
			declarations: [
				{ type: 'VariableDeclarator', id: index, init: b.literal(0) },
				{ type: 'VariableDeclarator', id: length, init: b.member(items, 'length') }
			]
		},
		test: b.binary('<', index, length),
		update: { type: 'UpdateExpression', operator: '++', prefix: false, argument: index },
		body: { type: 'BlockStatement', body: [...item, ...body.body] }
	};
	const push = (html: string): ES.Statement =>
		b.statement(b.call(b.member(context.out, 'push'), b.literal(html)));
	if (node.fallback !== null) {
		statements.push({
			type: 'IfStatement',
			test: b.binary('!==', b.member(items, 'length'), b.literal(0)),
			consequent: { type: 'BlockStatement', body: [push(open), loop] },
			alternate: section(context, openElse, node.fallback, true)
		});
	} else {
		statements.push(push(open), loop);
	}
}

function awaited(context: TemplateContext, node: AsyncBlock, statements: ES.Statement[]): void {
	const value = b.id(context.names.unique('$$promise'));
	statements.push(b.constant(value.name, rewrite(context, node.promise)));
	const pending = section(context, open, node.pending, false);
	const then = section(context, openElse, node.resolved?.body ?? null, false);
	const binding = node.resolved?.binding ?? null;
	if (binding !== null) {
		then.body.unshift({
			type: 'VariableDeclaration',
			kind: 'const',
			declarations: [{ type: 'VariableDeclarator', id: rewrite(context, binding), init: value }]
		});
	}
	pending.body.unshift(
		b.statement(b.call(b.member(value, 'then'), b.literal(null), b.arrow([], [])))
	);
	const method: ES.ChainExpression = {
		type: 'ChainExpression',
		expression: {
			type: 'MemberExpression',
			object: value,
			property: b.id('then'),
			computed: false,
			optional: true
		}
	};
	const kind: ES.UnaryExpression = {
		type: 'UnaryExpression',
		operator: 'typeof',
		prefix: true,
		argument: method
	};
	const thenable = b.binary('===', kind, b.literal('function'));
	statements.push({ type: 'IfStatement', test: thenable, consequent: pending, alternate: then });
}

export function blockCode(
	context: TemplateContext,
	node: Block,
	statements: ES.Statement[],
	buffer: Buffer
): void {
	if (node.kind === 'keyed-block') {
		buffer.text(empty);
		fragmentCode(context, cleaned(context, node.body), statements, buffer, false);
		buffer.text(empty);
		return;
	}
	buffer.flush(context, statements);
	if (node.kind === 'branch') branch(context, node, statements);
	else if (node.kind === 'async-block') awaited(context, node, statements);
	else list(context, node, statements);
	buffer.text(close);
}
