import type * as ES from 'estree';
import type { Context } from './context.ts';
import { fail } from './report.ts';
import { classBody, propertyDefinition } from './classes.ts';
import { identifiers, isReference, typeOf, type Binding } from './scope.ts';
import { assignment } from './assignment.ts';
import { settle } from './scopes.ts';

export const runeNames = new Set([
	'$state',
	'$state.raw',
	'$derived',
	'$derived.by',
	'$state.eager',
	'$state.snapshot',
	'$props',
	'$props.id',
	'$bindable',
	'$effect',
	'$effect.pre',
	'$effect.tracking',
	'$effect.root',
	'$effect.pending',
	'$inspect',
	'$inspect().with',
	'$inspect.trace',
	'$host'
]);

function isFunction(node: unknown): boolean {
	const type = (node as { type?: string } | undefined)?.type;
	return (
		type === 'FunctionDeclaration' ||
		type === 'FunctionExpression' ||
		type === 'ArrowFunctionExpression'
	);
}

function declarationPlacement(context: Context, parent: ES.Node): boolean {
	if (parent.type === 'VariableDeclarator') {
		const owner = context.at(-2);
		return owner === undefined || typeOf(owner) !== 'constant';
	}
	if (parent.type === 'PropertyDefinition') return !parent.static && !parent.computed;
	if (
		parent.type === 'AssignmentExpression' &&
		parent.operator === '=' &&
		parent.left.type === 'MemberExpression' &&
		parent.left.object.type === 'ThisExpression' &&
		((parent.left.property.type === 'Identifier' && !parent.left.computed) ||
			parent.left.property.type === 'PrivateIdentifier' ||
			parent.left.property.type === 'Literal')
	) {
		const method = context.at(-5);
		return method?.type === 'MethodDefinition' && method.kind === 'constructor';
	}
	return false;
}

function call(context: Context, node: ES.CallExpression): void {
	const parent = context.at(-1) as ES.Node;
	const rune = context.rune(node);
	if (rune !== null && rune !== '$inspect') {
		for (const argument of node.arguments) {
			if (argument.type === 'SpreadElement') fail('rune_invalid_spread', node, { rune });
		}
	}
	const count = node.arguments.length;
	const exactly = (): void => {
		if (count !== 1)
			fail('rune_invalid_arguments_length', node, { rune, args: 'exactly one argument' });
	};
	switch (rune) {
		case '$bindable': {
			if (count > 1)
				fail('rune_invalid_arguments_length', node, { rune, args: 'zero or one arguments' });
			const declarator = context.at(-4);
			if (
				parent.type !== 'AssignmentPattern' ||
				context.at(-3)?.type !== 'ObjectPattern' ||
				declarator?.type !== 'VariableDeclarator' ||
				context.rune(declarator.init) !== '$props'
			) {
				fail('bindable_invalid_location', node);
			}
			break;
		}
		case '$host':
			if (count > 0) fail('rune_invalid_arguments', node, { rune });
			else if (context.program === 'module' || !context.settings.customElement) {
				fail('host_invalid_placement', node);
			}
			break;
		case '$props':
			if (context.hasProps) fail('props_duplicate', node, { rune });
			context.hasProps = true;
			if (
				parent.type !== 'VariableDeclarator' ||
				context.program !== 'instance' ||
				context.scope !== context.instance
			) {
				fail('props_invalid_placement', node);
			}
			if (count > 0) fail('rune_invalid_arguments', node, { rune });
			break;
		case '$props.id':
			if (context.propsId !== null) fail('props_duplicate', node, { rune });
			if (
				parent.type !== 'VariableDeclarator' ||
				parent.id.type !== 'Identifier' ||
				context.program !== 'instance' ||
				context.scope !== context.instance ||
				context.at(-2)?.type !== 'VariableDeclaration'
			) {
				fail('props_id_invalid_placement', node);
			}
			if (count > 0) fail('rune_invalid_arguments', node, { rune });
			context.propsId = parent.id;
			break;
		case '$state':
		case '$state.raw':
		case '$derived':
		case '$derived.by':
			if (!declarationPlacement(context, parent)) fail('state_invalid_placement', node, { rune });
			if ((rune === '$derived' || rune === '$derived.by') && count !== 1) {
				fail('rune_invalid_arguments_length', node, { rune, args: 'exactly one argument' });
			} else if (count > 1) {
				fail('rune_invalid_arguments_length', node, { rune, args: 'zero or one arguments' });
			}
			break;
		case '$effect':
		case '$effect.pre':
			if (parent.type !== 'ExpressionStatement') fail('effect_invalid_placement', node);
			exactly();
			break;
		case '$effect.tracking':
			if (count !== 0) fail('rune_invalid_arguments', node, { rune });
			break;
		case '$effect.root':
		case '$state.eager':
		case '$state.snapshot':
			exactly();
			break;
		case '$inspect':
			if (count < 1) {
				fail('rune_invalid_arguments_length', node, { rune, args: 'one or more arguments' });
			}
			break;
		case '$inspect.trace': {
			if (count > 1)
				fail('rune_invalid_arguments_length', node, { rune, args: 'zero or one arguments' });
			const block = context.at(-2);
			const fn = context.at(-3);
			if (
				parent.type !== 'ExpressionStatement' ||
				block?.type !== 'BlockStatement' ||
				!isFunction(fn) ||
				block.body[0] !== parent
			) {
				fail('inspect_trace_invalid_placement', node);
			}
			if ((fn as ES.FunctionExpression).generator) fail('inspect_trace_generator', node);
			break;
		}
		default:
			break;
	}
	if (rune === '$derived' || rune === '$inspect') {
		context.deeper(context.depth + 1, () => context.next(node));
	} else {
		context.next(node);
	}
}

function proxied(context: Context, node: ES.Node | null | undefined, resolve: boolean): boolean {
	if (
		node === null ||
		node === undefined ||
		node.type === 'Literal' ||
		node.type === 'TemplateLiteral' ||
		node.type === 'ArrowFunctionExpression' ||
		node.type === 'FunctionExpression' ||
		node.type === 'UnaryExpression' ||
		node.type === 'BinaryExpression' ||
		(node.type === 'Identifier' && node.name === 'undefined')
	) {
		return false;
	}
	if (node.type === 'Identifier' && resolve) {
		const binding = context.scope.get(node.name);
		const initial = binding?.initial as { type?: string } | null | undefined;
		if (
			binding !== null &&
			binding !== undefined &&
			!binding.reassigned &&
			initial !== null &&
			initial !== undefined &&
			'type' in initial &&
			initial.type !== 'FunctionDeclaration' &&
			initial.type !== 'ClassDeclaration' &&
			initial.type !== 'ImportDeclaration'
		) {
			return proxied(context, initial as ES.Node, false);
		}
	}
	return true;
}

function local(context: Context, binding: Binding): boolean {
	switch (binding.kind) {
		case 'state': {
			if (binding.reassigned) return true;
			const initial = binding.initial as ES.Node | null;
			return (
				initial?.type === 'CallExpression' &&
				initial.arguments.length === 1 &&
				initial.arguments[0]?.type !== 'SpreadElement' &&
				!proxied(context, initial.arguments[0] as ES.Expression, true)
			);
		}
		case 'raw_state':
		case 'derived':
		case 'prop':
		case 'rest_prop':
			return true;
		default:
			return false;
	}
}

function runeName(context: Context, node: ES.Identifier, start: number): void {
	let index = start;
	let parent = context.path[index] as ES.Node;
	let current: ES.Node = node;
	let name = node.name;
	while (parent.type === 'MemberExpression') {
		if (parent.computed) fail('rune_invalid_computed_property', parent);
		name += `.${(parent.property as ES.Identifier).name}`;
		current = parent;
		parent = context.path[--index] as ES.Node;
		if (!runeNames.has(name)) {
			if (name === '$effect.active') {
				fail('rune_renamed', parent, { name: '$effect.active', replacement: '$effect.tracking' });
			}
			if (name === '$state.frozen') {
				fail('rune_renamed', parent, { name: '$state.frozen', replacement: '$state.raw' });
			}
			if (name === '$state.is') fail('rune_removed', parent, { name: '$state.is' });
			fail('rune_invalid_name', parent, { name });
		}
	}
	if (parent.type !== 'CallExpression') fail('rune_missing_parentheses', current);
}

function identifier(context: Context, node: ES.Identifier): void {
	const start = context.path.length - 1;
	const parent = context.path[start] as ES.Node | undefined;
	if (!isReference(node, parent)) return;
	if (
		node.name === 'arguments' &&
		!context.path.some(
			(n) => typeOf(n) === 'FunctionDeclaration' || typeOf(n) === 'FunctionExpression'
		)
	) {
		fail('invalid_arguments_usage', node);
	}
	if (
		runeNames.has(node.name) &&
		context.scope.get(node.name) === null &&
		context.scope.get(node.name.slice(1))?.kind !== 'store_sub'
	) {
		runeName(context, node, start);
	}
	const binding = context.scope.get(node.name);
	if (binding === null || parent === undefined) return;
	if (
		node !== binding.node &&
		context.depth === binding.scope.depth &&
		local(context, binding) &&
		(parent.type !== 'AssignmentExpression' || parent.left !== node) &&
		parent.type !== 'UpdateExpression'
	) {
		let type = 'closure';
		for (let index = context.path.length - 1; index >= 0; index--) {
			const ancestor = context.path[index] as ES.Node;
			if (isFunction(ancestor)) break;
			if (
				ancestor.type === 'CallExpression' &&
				ancestor.arguments.includes(context.path[index + 1] as ES.Expression)
			) {
				const rune = context.rune(ancestor);
				if (rune === '$state' || rune === '$state.raw') {
					type = 'derived';
					break;
				}
			}
		}
		context.report.warn('state_referenced_locally', node, { name: node.name, type });
	}
	if (binding.templateDeclaration && context.settings.async)
		templateReference(context, node, binding);
}

function templateReference(context: Context, node: ES.Identifier, binding: Binding): void {
	let snippet: string | null = null;
	for (let index = context.path.length - 1; index >= 1; index--) {
		const ancestor = context.path[index]!;
		const owner = context.path[index - 1]!;
		const kind = typeOf(ancestor);
		if (kind === 'snippet') {
			snippet = (ancestor as { name: ES.Identifier }).name.name;
			continue;
		}
		if (snippet === null || kind !== 'fragment') continue;
		const ownerKind = typeOf(owner);
		if (
			ownerKind !== 'component' &&
			!(ownerKind === 'boundary' && (snippet === 'failed' || snippet === 'pending'))
		) {
			continue;
		}
		if (context.scopes.map.get(ancestor) === binding.scope) {
			fail('const_tag_invalid_reference', node, { name: node.name });
		}
		break;
	}
}

function validName(binding: Binding | null): void {
	if (binding === null) return;
	if (
		binding.declaration === 'synthetic' ||
		binding.declaration === 'param' ||
		binding.declaration === 'rest_param'
	)
		return;
	if (binding.node.name === '$') fail('dollar_binding_invalid', binding.node);
	if (binding.node.name.startsWith('$')) fail('dollar_prefix_invalid', binding.node);
}

function declarator(context: Context, node: ES.VariableDeclarator): void {
	const module = context.module;
	if (context.program === 'instance' && context.scope === context.instance) {
		for (const id of identifiers(node.id)) {
			if (module.get(id.name)?.declaration === 'import')
				fail('declaration_duplicate_module_import', node.id);
		}
	}
	for (const id of identifiers(node.id)) validName(context.scope.get(id.name));
	const rune = context.rune(node.init);
	settle(node, context.scope, context.runes, rune);
	if (rune !== '$props') {
		context.next(node);
		return;
	}
	if (node.id.type !== 'ObjectPattern' && node.id.type !== 'Identifier')
		fail('props_invalid_identifier', node);
	if (context.settings.customElement && !context.settings.customProps) {
		const rest =
			node.id.type === 'ObjectPattern'
				? node.id.properties.find((p) => p.type === 'RestElement')
				: undefined;
		if (node.id.type === 'Identifier' || rest !== undefined) {
			context.report.warn('custom_element_props_identifier', rest ?? node.id);
		}
	}
	if (node.id.type === 'ObjectPattern') {
		for (const property of node.id.properties) {
			if (property.type !== 'Property') continue;
			if (property.computed) fail('props_invalid_pattern', property);
			if (property.key.type === 'Identifier' && property.key.name.startsWith('$$'))
				fail('props_illegal_name', property);
			const value =
				property.value.type === 'AssignmentPattern' ? property.value.left : property.value;
			if (value.type !== 'Identifier') fail('props_invalid_pattern', property);
		}
	}
	context.path.push(node);
	context.deeper(context.depth + 1, () => context.es(node.id));
	if (node.init) context.es(node.init);
	context.path.pop();
}

function exportValue(context: Context, node: ES.Node, name: string): void {
	const binding = context.scope.get(name);
	if (binding === null) return;
	if (binding.kind === 'derived') fail('derived_invalid_export', node);
	if ((binding.kind === 'state' || binding.kind === 'raw_state') && binding.reassigned)
		fail('state_invalid_export', node);
}

function exportNamed(context: Context, node: ES.ExportNamedDeclaration): void {
	context.next(node);
	if (
		context.program !== null &&
		node.specifiers.some((specifier) =>
			specifier.exported.type === 'Identifier'
				? specifier.exported.name === 'default'
				: specifier.exported.value === 'default'
		)
	) {
		fail('module_illegal_default_export', node);
	}
	if (node.declaration?.type !== 'VariableDeclaration') return;
	for (const declarator of node.declaration.declarations) {
		for (const id of identifiers(declarator.id)) exportValue(context, node, id.name);
	}
	if (context.program === 'instance' && node.declaration.kind === 'let')
		fail('legacy_export_invalid', node);
}

function exportSpecifier(context: Context, node: ES.ExportSpecifier): void {
	const name = node.local.type === 'Identifier' ? node.local.name : String(node.local.value);
	if (context.program === 'instance') {
		const binding = context.scope.get(name);
		if (binding !== null) binding.reassigned = true;
	} else {
		exportValue(context, node, name);
	}
}

function expressionStatement(context: Context, node: ES.ExpressionStatement): void {
	const expression = node.expression;
	if (
		expression.type === 'NewExpression' &&
		expression.callee.type === 'Identifier' &&
		expression.arguments.length === 1 &&
		expression.arguments[0]?.type === 'ObjectExpression' &&
		expression.arguments[0].properties.some(
			(p) => p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === 'target'
		)
	) {
		const binding = context.scope.get(expression.callee.name);
		const initial = binding?.initial as ES.ImportDeclaration | null | undefined;
		if (
			binding?.kind === 'normal' &&
			binding.declaration === 'import' &&
			initial?.specifiers.some(
				(s) => s.local.name === binding.node.name && s.type === 'ImportDefaultSpecifier'
			)
		) {
			context.report.warn('legacy_component_creation', expression);
		}
	}
	context.next(node);
}

function enterFunction(context: Context, node: ES.Node): void {
	context.deeper(Math.max(context.scope.depth, context.depth) + 1, () => context.next(node));
}

export function visit(context: Context, node: ES.Node): void {
	switch (node.type) {
		case 'CallExpression':
			call(context, node);
			return;
		case 'Identifier':
			identifier(context, node);
			return;
		case 'AssignmentExpression':
			assignment(context, node, node.left);
			context.next(node);
			return;
		case 'UpdateExpression':
			assignment(context, node, node.argument);
			context.next(node);
			return;
		case 'MemberExpression':
			if (node.object.type === 'Identifier' && node.property.type === 'Identifier') {
				const binding = context.scope.get(node.object.name);
				if (binding?.kind === 'rest_prop' && node.property.name.startsWith('$$'))
					fail('props_illegal_name', node.property);
			}
			context.next(node);
			return;
		case 'VariableDeclarator':
			declarator(context, node);
			return;
		case 'ExportNamedDeclaration':
			exportNamed(context, node);
			return;
		case 'ExportDefaultDeclaration':
			if (context.program === null) {
				if (node.declaration.type === 'Identifier')
					exportValue(context, node, node.declaration.name);
			} else {
				fail('module_illegal_default_export', node);
			}
			context.next(node);
			return;
		case 'ExportSpecifier':
			exportSpecifier(context, node);
			return;
		case 'ImportDeclaration':
			return;
		case 'ExpressionStatement':
			expressionStatement(context, node);
			return;
		case 'ClassBody':
			classBody(context, node);
			return;
		case 'PropertyDefinition':
			propertyDefinition(context, node);
			context.next(node);
			return;
		case 'FunctionDeclaration':
			if (node.id !== null) validName(context.scope.get(node.id.name));
			enterFunction(context, node);
			return;
		case 'FunctionExpression':
		case 'ArrowFunctionExpression':
			enterFunction(context, node);
			return;
		case 'ClassDeclaration':
			if (node.id !== null) validName(context.scope.get(node.id.name));
			if (context.scope.depth > (context.program === 'module' ? 0 : 1))
				context.report.warn('perf_avoid_nested_class', node);
			context.next(node);
			return;
		case 'NewExpression':
			if (node.callee.type === 'ClassExpression' && context.scope.depth > 0)
				context.report.warn('perf_avoid_inline_class', node);
			context.next(node);
			return;
		default:
			context.next(node);
	}
}
