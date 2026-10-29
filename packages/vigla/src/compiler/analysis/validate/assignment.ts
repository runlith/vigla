import type * as ES from 'estree';
import type { At } from './report.ts';
import { fail } from './report.ts';
import type { Context } from './context.ts';
import type { Scope } from './scope.ts';
import { fieldName } from './classes.ts';

function constant(node: At, argument: ES.Node, scope: Scope, binding: boolean): void {
	switch (argument.type) {
		case 'ArrayPattern':
			for (const element of argument.elements) if (element) constant(node, element, scope, binding);
			return;
		case 'ObjectPattern':
			for (const property of argument.properties) {
				if (property.type === 'Property') constant(node, property.value, scope, binding);
			}
			return;
		case 'Identifier': {
			const found = scope.get(argument.name);
			if (found === null) return;
			if (
				found.declaration !== 'import' &&
				(found.declaration !== 'const' || found.kind === 'each')
			)
				return;
			const thing = found.declaration === 'import' ? 'import' : 'constant';
			fail(binding ? 'constant_binding' : 'constant_assignment', node, { thing });
		}
		default:
			return;
	}
}

export function assignment(
	context: Context,
	node: ES.Node | (At & object),
	argument: ES.Node,
	binding = false
): void {
	constant(node, argument, context.scope, binding);
	if (argument.type === 'Identifier') {
		const found = context.scope.get(argument.name);
		if (context.propsId !== null && found?.node === context.propsId) {
			fail('constant_assignment', node, { thing: '$props.id()' });
		}
		if (found?.kind === 'each') fail('each_item_invalid_assignment', node);
		if (found?.kind === 'snippet') fail('snippet_parameter_assignment', node);
	}
	if (argument.type !== 'MemberExpression' || argument.object.type !== 'ThisExpression') return;
	const name =
		argument.computed && argument.property.type !== 'Literal' ? null : fieldName(argument.property);
	const field = name === null ? undefined : context.fields?.get(name);
	if (field === undefined || field.node.type !== 'AssignmentExpression' || node === field.node)
		return;
	for (let index = context.path.length - 1; index >= 0; index--) {
		const ancestor = context.path[index] as ES.Node;
		if (
			ancestor.type !== 'FunctionDeclaration' &&
			ancestor.type !== 'FunctionExpression' &&
			ancestor.type !== 'ArrowFunctionExpression'
		) {
			continue;
		}
		const owner = context.path[index - 1] as ES.Node | undefined;
		if (
			owner?.type === 'MethodDefinition' &&
			owner.kind === 'constructor' &&
			((node as { start?: number }).start ?? 0) < ((field.node as { start?: number }).start ?? 0)
		) {
			fail('state_field_invalid_assignment', node);
		}
		return;
	}
}
