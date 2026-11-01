import type * as ES from 'estree';
import { fieldName, spanOf, unsupported, type StateField } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import { runtime, type Context } from './script.ts';

type Next = <T extends ES.Node>(node: T) => T;

function derivedField(field: StateField): boolean {
	return field.rune === '$derived' || field.rune === '$derived.by';
}

export function fieldValue(context: Context, field: StateField, next: Next): ES.Expression {
	const [first] = field.value.arguments;
	if (first?.type === 'SpreadElement') throw unsupported(spanOf(first), 'A spread rune argument');
	const value = first === undefined ? b.id('undefined') : next(first);
	switch (field.rune) {
		case '$state':
		case '$state.raw':
			return value;
		case '$derived':
			return runtime(context, 'derived', b.arrow([], value));
		case '$derived.by':
			return runtime(context, 'derived', value);
	}
}

function member(key: ES.PrivateIdentifier): ES.MemberExpression {
	return {
		type: 'MemberExpression',
		object: { type: 'ThisExpression' },
		property: key,
		computed: false,
		optional: false
	};
}

function accessors(
	field: StateField,
	key: ES.Expression,
	computed: boolean
): ES.MethodDefinition[] {
	const value = b.id('value');
	const make = (
		kind: 'get' | 'set',
		params: ES.Pattern[],
		body: ES.Statement[]
	): ES.MethodDefinition => ({
		type: 'MethodDefinition',
		key,
		computed,
		static: false,
		kind,
		value: b.functionExpression(params, body)
	});
	return [
		make('get', [], [{ type: 'ReturnStatement', argument: b.call(member(field.key)) }]),
		make('set', [value], [b.statement(b.call(member(field.key), value))])
	];
}

function definition(
	key: ES.Expression | ES.PrivateIdentifier,
	value: ES.Expression | null,
	computed = false
): ES.PropertyDefinition {
	return { type: 'PropertyDefinition', key, value, computed, static: false };
}

export function classBody(
	context: Context,
	body: ES.ClassBody,
	fields: ReadonlyMap<string, StateField>,
	next: Next
): ES.ClassBody {
	const members: ES.ClassBody['body'] = [];
	for (const [name, field] of fields) {
		if (name.startsWith('#') || field.node.type !== 'AssignmentExpression' || !derivedField(field))
			continue;
		const left = field.node.left as ES.MemberExpression;
		members.push(
			definition(field.key, null),
			...accessors(field, left.property as ES.Expression, left.computed)
		);
	}
	for (const item of body.body) {
		if (item.type !== 'PropertyDefinition' || item.static) {
			members.push(next(item));
			continue;
		}
		const name = fieldName(item.key, item.computed);
		const field = name === null ? undefined : fields.get(name);
		if (
			field?.node.type === 'AssignmentExpression' &&
			derivedField(field) &&
			item.value == null &&
			name !== null &&
			!name.startsWith('#')
		)
			continue;
		if (field === undefined || field.node !== item) {
			members.push(next(item));
			continue;
		}
		const value = fieldValue(context, field, next);
		if (item.key.type === 'PrivateIdentifier' || !derivedField(field)) {
			members.push(definition(item.key, value, item.computed));
			continue;
		}
		members.push(
			definition(field.key, value),
			...accessors(field, item.key as ES.Expression, item.computed)
		);
	}
	return { ...body, body: members };
}

export function privateDerived(
	context: Context,
	node: ES.MemberExpression
): StateField | undefined {
	if (node.property.type !== 'PrivateIdentifier') return undefined;
	const field = context.fields?.get(`#${node.property.name}`);
	return field !== undefined && derivedField(field) ? field : undefined;
}

export function constructorField(
	context: Context,
	node: ES.AssignmentExpression
): StateField | undefined {
	const left = node.left;
	if (left.type !== 'MemberExpression' || left.object.type !== 'ThisExpression') return undefined;
	const name = fieldName(left.property, left.computed);
	const field = name === null ? undefined : context.fields?.get(name);
	return field?.node === node ? field : undefined;
}

export function isDerivedField(field: StateField): boolean {
	return derivedField(field);
}
