import type * as ES from 'estree';
import { hasAwait, patternNames, type Binding } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type {
	AsyncBlock,
	Branch,
	Fragment,
	KeyedBlock,
	KeyedList,
	Outcome,
	UnkeyedList
} from '../ir/nodes.ts';
import { asyncThunk, rewrite, runtime } from './script.ts';
import { scoped } from './meta.ts';
import { cleaned, render, type TemplateContext } from './template.ts';

export type Block = Branch | KeyedList | UnkeyedList | KeyedBlock | AsyncBlock;

export function arm(
	context: TemplateContext,
	fragment: Fragment,
	textFirst: boolean,
	params: readonly ES.Pattern[] = [],
	prelude: readonly ES.Statement[] = []
): ES.ArrowFunctionExpression {
	const anchor = b.id(context.names.unique('$$anchor'));
	const namespace = context.component.fragmentNamespaces.get(fragment) ?? 'html';
	return b.arrow(
		[anchor, ...params],
		[
			...prelude,
			...render(
				{ ...context, structural: true },
				cleaned(context, fragment),
				anchor,
				namespace,
				textFirst
			)
		]
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

function destructure(pattern: ES.Pattern, value: ES.Expression): ES.VariableDeclaration {
	return {
		type: 'VariableDeclaration',
		kind: 'const',
		declarations: [{ type: 'VariableDeclarator', id: pattern, init: value }]
	};
}

export function patternValues(
	context: TemplateContext,
	pattern: ES.Pattern,
	names: readonly Binding[],
	source: ES.Identifier
): ES.Statement[] {
	const inner = { ...context, plain: new Set([...context.plain, ...names]) };
	const values = b.id(context.names.unique('$$values'));
	const tuple: ES.ArrayExpression = {
		type: 'ArrayExpression',
		elements: names.map((binding) => b.id(binding.name))
	};
	const statements: ES.Statement[] = [
		b.constant(
			values.name,
			runtime(
				context,
				'derived',
				b.arrow(
					[],
					[
						destructure(rewrite(inner, pattern), runtime(context, 'get', source)),
						{ type: 'ReturnStatement', argument: tuple }
					]
				)
			)
		)
	];
	names.forEach((binding, position) => {
		const read: ES.MemberExpression = {
			type: 'MemberExpression',
			object: runtime(context, 'get', values),
			property: b.literal(position),
			computed: true,
			optional: false
		};
		statements.push(b.constant(binding.name, runtime(context, 'derived', b.arrow([], read))));
	});
	return statements;
}

function listCode(
	context: TemplateContext,
	node: KeyedList | UnkeyedList,
	anchor: ES.Identifier
): ES.Statement[] {
	const facts = context.component.lists.get(node);
	if (facts === undefined) throw new Error('each block was not analyzed');
	const named = node.item?.type === 'Identifier' ? node.item : null;
	const item = named !== null ? { ...named } : b.id(context.names.unique('$$item'));
	const index = b.id(facts.index?.name ?? context.names.unique('$$index'));
	const collection = b.arrow([], rewrite(context, node.collection));
	const plain = new Set([...context.plain, ...facts.names]);
	if (facts.index !== null) plain.add(facts.index);
	let key: ES.Expression = b.literal(null);
	if (node.kind === 'keyed-list') {
		const inner = { ...context, plain };
		const value = rewrite(inner, node.key);
		key =
			node.item === null || named !== null
				? b.arrow([item, index], value)
				: b.arrow(
						[item, index],
						[
							destructure(rewrite(inner, node.item), item),
							{ type: 'ReturnStatement', argument: value }
						]
					);
	}
	const prelude =
		node.item === null || named !== null
			? []
			: patternValues(context, node.item, facts.names, item);
	let mutable = false;
	b.walk(node.collection, (node) => {
		if (node.type === 'Identifier' && context.analysis.externals.has(node)) mutable = true;
	});
	const body = arm({ ...context, externalRows: mutable }, node.body, true, [item, index], prelude);
	const args: ES.Expression[] = [anchor, collection, key, body];
	if (node.fallback !== null || mutable)
		args.push(node.fallback === null ? b.literal(null) : arm(context, node.fallback, true));
	if (mutable) args.push(b.literal(true));
	return [b.statement(runtime(context, 'list', ...args))];
}

function outcomeArm(context: TemplateContext, outcome: Outcome | null): ES.Expression {
	if (outcome === null) return b.literal(null);
	const binding = outcome.binding;
	if (binding === null) return arm(context, outcome.body, false);
	if (binding.type === 'Identifier') return arm(context, outcome.body, false, [b.id(binding.name)]);
	const declarations = context.analysis.declarations;
	const names = patternNames(binding).flatMap((name) => {
		const found = declarations.get(name);
		return found === undefined ? [] : [found];
	});
	const value = b.id(context.names.unique('$$value'));
	return arm(context, outcome.body, false, [value], patternValues(context, binding, names, value));
}

function awaitCode(
	context: TemplateContext,
	node: AsyncBlock,
	anchor: ES.Identifier
): ES.Statement[] {
	return [
		b.statement(
			runtime(
				context,
				'awaited',
				anchor,
				hasAwait(node.promise, context.awaited)
					? asyncThunk(context, node.promise)
					: b.arrow([], rewrite(context, node.promise)),
				node.pending === null ? b.literal(null) : arm(context, node.pending, false),
				outcomeArm(context, node.resolved),
				outcomeArm(context, node.rejected)
			)
		)
	];
}

function keyCode(
	context: TemplateContext,
	node: KeyedBlock,
	anchor: ES.Identifier
): ES.Statement[] {
	return [
		b.statement(
			runtime(
				context,
				'key',
				anchor,
				b.arrow([], rewrite(context, node.key)),
				arm(context, node.body, false)
			)
		)
	];
}

export function blockCode(
	context: TemplateContext,
	node: Block,
	anchor: ES.Identifier
): ES.Statement[] {
	switch (node.kind) {
		case 'branch':
			return scoped(context, node, 'if', branchCode(context, node, anchor));
		case 'keyed-list':
		case 'unkeyed-list':
			return scoped(context, node, 'each', listCode(context, node, anchor));
		case 'keyed-block':
			return scoped(context, node, 'key', keyCode(context, node, anchor));
		case 'async-block':
			return scoped(context, node, 'await', awaitCode(context, node, anchor));
	}
}
