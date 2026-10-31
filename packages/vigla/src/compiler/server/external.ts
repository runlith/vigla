import type * as ES from 'estree';
import * as b from '../ir/estree.ts';
import type { ExternalBinding } from '../ir/port.ts';
import { rewrite, runtime, type Context } from './script.ts';

export function prepare(context: Context, bindings: readonly ExternalBinding[]): ES.Statement[] {
	const cells = context.externalCells!;
	for (const binding of bindings)
		cells.set(binding, b.id(context.names.unique(`$$external_${binding.name}`)));
	return bindings.map((binding) =>
		b.constant(
			cells.get(binding)!.name,
			runtime(
				context,
				'external',
				b.arrow([], rewrite(context, binding.source)),
				b.literal(binding.name)
			)
		)
	);
}

function cell(context: Context, node: ES.Identifier): ES.Identifier | undefined {
	const binding = context.analysis.externals.get(node);
	return binding === undefined ? undefined : context.externalCells?.get(binding);
}

function bound(context: Context, node: ES.Identifier): boolean {
	if (cell(context, node) !== undefined) return true;
	const binding = context.analysis.references.get(node);
	if (binding === undefined) return false;
	if (
		binding.kind === 'state' ||
		binding.kind === 'raw-state' ||
		binding.kind === 'derived' ||
		binding.kind === 'prop'
	)
		return true;
	return [...(context.externalCells?.keys() ?? [])].some(
		(input) =>
			input.source.type === 'Identifier' &&
			context.analysis.references.get(input.source) === binding
	);
}

function pattern(
	context: Context,
	target: ES.Pattern,
	next: <T extends ES.Node>(node: T) => T
): ES.Pattern {
	switch (target.type) {
		case 'Identifier': {
			const selected = cell(context, target);
			if (selected !== undefined) return b.member(selected, 'current');
			if (!bound(context, target)) return target;
			const value = b.id(context.names.unique('$$value'));
			const write: ES.AssignmentExpression = {
				type: 'AssignmentExpression',
				operator: '=',
				left: target,
				right: value
			};
			return b.member(
				runtime(context, 'assignment', b.arrow([value], rewrite(context, write))),
				'current'
			);
		}
		case 'MemberExpression': {
			let base: ES.Node = target;
			while (base.type === 'MemberExpression') base = base.object;
			const selected = base.type === 'Identifier' ? cell(context, base) : undefined;
			const object = next(
				b.rewrite(target.object, (node) =>
					node === base && selected !== undefined ? b.member(selected, 'peek') : undefined
				)
			);
			const key = target.computed
				? next(target.property as ES.Expression)
				: b.literal((target.property as ES.Identifier).name);
			if (selected !== undefined)
				return b.member(
					runtime(
						context,
						'mutationTarget',
						object as ES.Expression,
						key,
						b.arrow([], b.call(b.member(selected, 'mutate'), b.id('undefined')))
					),
					'current'
				);
			return {
				...target,
				object: object as ES.Expression,
				property: target.computed ? key : target.property
			};
		}
		case 'ArrayPattern':
			return {
				...target,
				elements: target.elements.map((element) =>
					element === null ? null : pattern(context, element, next)
				)
			};
		case 'ObjectPattern':
			return {
				...target,
				properties: target.properties.map((property) =>
					property.type === 'RestElement'
						? { ...property, argument: pattern(context, property.argument, next) }
						: {
								...property,
								key: property.computed ? next(property.key) : property.key,
								value: pattern(context, property.value, next),
								shorthand: false
							}
				)
			};
		case 'AssignmentPattern':
			return { ...target, left: pattern(context, target.left, next), right: next(target.right) };
		case 'RestElement':
			return { ...target, argument: pattern(context, target.argument, next) };
	}
}

export function external(
	context: Context,
	node: ES.Node,
	next: <T extends ES.Node>(node: T) => T
): ES.Node | undefined {
	if (node.type === 'Identifier') {
		const target = cell(context, node);
		return target === undefined ? undefined : b.member(target, 'current');
	}
	if (
		node.type === 'AssignmentExpression' &&
		(node.left.type === 'ArrayPattern' || node.left.type === 'ObjectPattern')
	) {
		let changes = false;
		b.walk(node.left, (node) => {
			if (node.type === 'Identifier' && bound(context, node)) changes = true;
		});
		if (changes)
			return { ...node, left: pattern(context, node.left, next), right: next(node.right) };
	}
	if (node.type !== 'AssignmentExpression' && node.type !== 'UpdateExpression') return;
	const target = node.type === 'AssignmentExpression' ? node.left : node.argument;
	let base: ES.Node = target;
	while (base.type === 'MemberExpression') base = base.object;
	if (base.type !== 'Identifier') return;
	const selected = cell(context, base);
	if (selected !== undefined) {
		const replacement = b.rewrite(target, (current) =>
			current === base ? b.member(selected, target === base ? 'current' : 'peek') : undefined
		);
		const expression = next(
			node.type === 'AssignmentExpression'
				? { ...node, left: replacement as ES.Pattern }
				: { ...node, argument: replacement as ES.Expression }
		);
		return target === base ? expression : b.call(b.member(selected, 'mutate'), expression);
	}
	if (context.refreshing === node || target !== base) return;
	const binding = context.analysis.references.get(base);
	if (binding === undefined) return;
	let expression: ES.Expression | undefined;
	for (const [input, selected] of context.externalCells ?? []) {
		if (
			input.source.type !== 'Identifier' ||
			context.analysis.references.get(input.source) !== binding
		)
			continue;
		expression ??= rewrite({ ...context, refreshing: node }, node);
		expression = b.call(b.member(selected, 'refresh'), expression);
	}
	return expression;
}
