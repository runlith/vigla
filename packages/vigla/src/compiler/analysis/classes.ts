import type * as ES from 'estree';
import { walk } from '../ir/estree.ts';
import type { Rune, Runes } from '../ir/port.ts';
import { spanOf, unsupported } from './scope.ts';

export type FieldRune = '$state' | '$state.raw' | '$derived' | '$derived.by';

const fieldRunes = new Set<Rune>(['$state', '$state.raw', '$derived', '$derived.by']);

export interface StateField {
	readonly rune: FieldRune;
	readonly node: ES.PropertyDefinition | ES.AssignmentExpression;
	readonly value: ES.CallExpression;
	readonly key: ES.PrivateIdentifier;
}

export type ClassFields = ReadonlyMap<ES.ClassBody, ReadonlyMap<string, StateField>>;

export function fieldName(key: ES.Node, computed: boolean): string | null {
	if (key.type === 'Literal') return String(key.value);
	if (computed) return null;
	if (key.type === 'Identifier') return key.name;
	if (key.type === 'PrivateIdentifier') return `#${key.name}`;
	return null;
}

function runeOf(runes: Runes, node: ES.Node | null | undefined): FieldRune | null {
	if (node?.type !== 'CallExpression') return null;
	const rune = runes.get(node.callee);
	return rune !== undefined && fieldRunes.has(rune) ? (rune as FieldRune) : null;
}

function constructorAssignments(body: ES.ClassBody): ES.AssignmentExpression[] {
	const found: ES.AssignmentExpression[] = [];
	for (const member of body.body) {
		if (member.type !== 'MethodDefinition' || member.kind !== 'constructor') continue;
		for (const statement of member.value.body.body) {
			if (statement.type !== 'ExpressionStatement') continue;
			const expression = statement.expression;
			if (
				expression.type === 'AssignmentExpression' &&
				expression.operator === '=' &&
				expression.left.type === 'MemberExpression' &&
				expression.left.object.type === 'ThisExpression'
			) {
				found.push(expression);
			}
		}
	}
	return found;
}

function fieldsOf(runes: Runes, body: ES.ClassBody, placed: Set<ES.Node>): Map<string, StateField> {
	const fields = new Map<string, StateField>();
	const privates = new Set<string>();
	for (const member of body.body) {
		if (
			(member.type === 'PropertyDefinition' || member.type === 'MethodDefinition') &&
			member.key.type === 'PrivateIdentifier'
		) {
			privates.add(member.key.name);
		}
	}
	const backing = (name: string): ES.PrivateIdentifier => {
		if (name.startsWith('#')) return { type: 'PrivateIdentifier', name: name.slice(1) };
		let candidate = name.replace(/[^A-Za-z0-9_$]/g, '_') || '_';
		if (/^[0-9]/.test(candidate) || candidate === 'constructor') candidate = `_${candidate}`;
		while (privates.has(candidate)) candidate = `_${candidate}`;
		privates.add(candidate);
		return { type: 'PrivateIdentifier', name: candidate };
	};
	const add = (
		name: string | null,
		node: StateField['node'],
		value: ES.Expression | null | undefined
	): void => {
		const rune = runeOf(runes, value);
		if (rune === null) return;
		if (name === null) throw unsupported(spanOf(node), 'A rune in a computed class field');
		if (fields.has(name))
			throw unsupported(spanOf(node), 'A class field declared twice with a rune');
		const call = value as ES.CallExpression;
		placed.add(call.callee);
		fields.set(name, { rune, node, value: call, key: backing(name) });
	};
	for (const member of body.body) {
		if (member.type !== 'PropertyDefinition' || member.static) continue;
		add(fieldName(member.key, member.computed), member, member.value);
	}
	for (const assignment of constructorAssignments(body)) {
		const left = assignment.left as ES.MemberExpression;
		add(fieldName(left.property, left.computed), assignment, assignment.right);
	}
	return fields;
}

export function classFields(
	runes: Runes,
	program: ES.Program | null,
	placed: Set<ES.Node>
): ClassFields {
	const classes = new Map<ES.ClassBody, ReadonlyMap<string, StateField>>();
	if (program === null) return classes;
	walk(program, (node) => {
		if (node.type !== 'ClassBody') return;
		const fields = fieldsOf(runes, node, placed);
		if (fields.size > 0) classes.set(node, fields);
	});
	return classes;
}
