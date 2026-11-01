import type * as ES from 'estree';
import { fieldName, spanOf, unsupported, type StateField } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import { runtime, type Context } from './script.ts';
import { tagged } from './inspect.ts';

type Next = <T extends ES.Node>(node: T) => T;

function primitive(node: ES.Expression): boolean {
	return (
		(node.type === 'Literal' && !('regex' in node)) ||
		(node.type === 'Identifier' && node.name === 'undefined')
	);
}

export function fieldValue(context: Context, field: StateField, next: Next): ES.Expression {
	const [first] = field.value.arguments;
	if (first?.type === 'SpreadElement') throw unsupported(spanOf(first), 'A spread rune argument');
	const value = first === undefined ? b.id('undefined') : next(first);
	const key =
		field.node.type === 'PropertyDefinition'
			? field.node.key
			: (field.node.left as ES.MemberExpression).property;
	const name =
		key.type === 'PrivateIdentifier'
			? `#${key.name}`
			: key.type === 'Identifier'
				? key.name
				: key.type === 'Literal'
					? String(key.value)
					: '';
	const tag = (value: ES.Expression): ES.Expression =>
		tagged(context, value, `${context.className ?? '(anonymous)'}.${name}`, true);
	switch (field.rune) {
		case '$state':
			return tag(
				runtime(context, 'state', primitive(value) ? value : runtime(context, 'proxy', value))
			);
		case '$state.raw':
			return tag(runtime(context, 'state', value));
		case '$derived':
			return tag(runtime(context, 'derived', b.arrow([], value)));
		case '$derived.by':
			return tag(runtime(context, 'derived', value));
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

function method(
	kind: 'get' | 'set',
	key: ES.Expression | ES.PrivateIdentifier,
	params: ES.Pattern[],
	body: ES.Statement[],
	computed: boolean
): ES.MethodDefinition {
	return {
		type: 'MethodDefinition',
		key,
		computed,
		static: false,
		kind,
		value: b.functionExpression(params, body)
	};
}

function accessors(
	context: Context,
	field: StateField,
	key: ES.Expression | ES.PrivateIdentifier,
	computed: boolean
): ES.MethodDefinition[] {
	const value = b.id('value');
	const proxied = field.rune === '$state' ? runtime(context, 'proxy', value) : value;
	return [
		method(
			'get',
			key,
			[],
			[{ type: 'ReturnStatement', argument: runtime(context, 'get', member(field.key)) }],
			computed
		),
		method(
			'set',
			key,
			[value],
			[b.statement(runtime(context, 'set', member(field.key), proxied))],
			computed
		)
	];
}

function definition(key: ES.PrivateIdentifier, value: ES.Expression | null): ES.PropertyDefinition {
	return { type: 'PropertyDefinition', key, value, computed: false, static: false };
}

export function classBody(
	context: Context,
	body: ES.ClassBody,
	fields: ReadonlyMap<string, StateField>,
	next: Next
): ES.ClassBody {
	const members: ES.ClassBody['body'] = [];
	for (const [name, field] of fields) {
		if (name.startsWith('#') || field.node.type !== 'AssignmentExpression') continue;
		const left = field.node.left as ES.MemberExpression;
		members.push(
			definition(field.key, null),
			...accessors(context, field, left.property as ES.Expression, left.computed)
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
		if (name?.startsWith('#')) {
			members.push(definition(field.key, value));
			continue;
		}
		members.push(
			definition(field.key, value),
			...accessors(context, field, item.key as ES.Expression, item.computed)
		);
	}
	return { ...body, body: members };
}

export function privateField(context: Context, node: ES.MemberExpression): StateField | undefined {
	if (node.property.type !== 'PrivateIdentifier') return undefined;
	return context.fields?.get(`#${node.property.name}`);
}
