import type * as ES from 'estree';
import type { Context, Field } from './context.ts';
import { fail } from './report.ts';

const creating = new Set(['$state', '$state.raw', '$derived', '$derived.by']);

export function fieldName(node: ES.Node): string | null {
	if (node.type === 'Literal') return String(node.value);
	if (node.type === 'PrivateIdentifier') return `#${node.name}`;
	if (node.type === 'Identifier') return node.name;
	return null;
}

type Kinds = string[];

export function classBody(context: Context, node: ES.ClassBody): void {
	const fields = new Map<string, Field>();
	const members = new Map<string, Kinds>();
	let constructor: ES.MethodDefinition | null = null;
	const handle = (
		owner: ES.PropertyDefinition | ES.AssignmentExpression,
		key: ES.Node,
		value: ES.Node | null | undefined
	): void => {
		const name = fieldName(key);
		if (name === null) return;
		const rune = context.rune(value);
		if (rune === null || !creating.has(rune)) return;
		if (fields.has(name)) fail('state_field_duplicate', owner, { name });
		const member = (owner.type === 'AssignmentExpression' || !owner.static ? '' : '@') + name;
		const kinds = members.get(member);
		if (kinds !== undefined && !(kinds.length === 1 && kinds[0] === 'prop')) {
			fail('duplicate_class_field', owner, { name: member });
		}
		fields.set(name, { node: owner });
	};
	for (const child of node.body) {
		if (child.type === 'PropertyDefinition' && !child.computed && !child.static) {
			handle(child, child.key, child.value);
			const key = fieldName(child.key) ?? '';
			if (!members.has(key)) {
				members.set(key, [child.value ? 'assigned_prop' : 'prop']);
				continue;
			}
			fail('duplicate_class_field', child, { name: key });
		}
		if (child.type !== 'MethodDefinition') continue;
		if (child.kind === 'constructor') {
			constructor = child;
			continue;
		}
		if (child.computed) continue;
		const key = (child.static ? '@' : '') + fieldName(child.key);
		const kinds = members.get(key);
		if (kinds === undefined) {
			members.set(key, [child.kind]);
			continue;
		}
		if (kinds.includes(child.kind) || kinds.includes('prop') || kinds.includes('assigned_prop')) {
			fail('duplicate_class_field', child, { name: key });
		}
		if (child.kind === 'get' && kinds.length === 1 && kinds[0] === 'set') {
			kinds.push('get');
			continue;
		}
		if (child.kind === 'set' && kinds.length === 1 && kinds[0] === 'get') {
			kinds.push('set');
			continue;
		}
		if (child.kind === 'method') {
			kinds.push(child.kind);
			continue;
		}
		fail('duplicate_class_field', child, { name: key });
	}
	if (constructor !== null) {
		for (const statement of constructor.value.body.body) {
			if (
				statement.type !== 'ExpressionStatement' ||
				statement.expression.type !== 'AssignmentExpression'
			)
				continue;
			const { left, right } = statement.expression;
			if (left.type !== 'MemberExpression' || left.object.type !== 'ThisExpression') continue;
			if (left.computed && left.property.type !== 'Literal') continue;
			handle(statement.expression, left.property, right);
		}
	}
	const saved = context.fields;
	context.fields = fields;
	context.next(node);
	context.fields = saved;
}

export function propertyDefinition(context: Context, node: ES.PropertyDefinition): void {
	const name = fieldName(node.key);
	const field = name === null ? undefined : context.fields?.get(name);
	if (field === undefined || node === field.node || !node.value) return;
	if ((node as { start?: number }).start! < (field.node as { start?: number }).start!) {
		fail('state_field_invalid_assignment', node);
	}
}
