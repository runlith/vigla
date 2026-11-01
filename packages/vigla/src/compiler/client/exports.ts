import type * as ES from 'estree';
import * as b from '../ir/estree.ts';
import { runtime, type Context } from './script.ts';

export interface DeferredExports {
	readonly setup: ES.Statement;
	readonly publish: ES.Statement;
	readonly properties: ES.Property[];
}

export function deferExports(context: Context, properties: ES.Property[]): DeferredExports {
	const cell = b.id(context.names.unique('$$exports'));
	return {
		setup: b.constant(cell.name, runtime(context, 'deferredExports')),
		publish: b.statement(
			b.call(b.member(cell, 'publish'), { type: 'ObjectExpression', properties })
		),
		properties: properties.map((property) => {
			const name =
				property.key.type === 'Identifier'
					? property.key.name
					: String((property.key as ES.Literal).value);
			const value = b.id(context.names.unique('$$value'));
			const setter = property.kind === 'set';
			const call = b.call(
				b.member(cell, setter ? 'set' : 'get'),
				b.literal(name),
				...(setter ? [value] : [])
			);
			return {
				...property,
				value: b.functionExpression(
					setter ? [value] : [],
					setter ? [b.statement(call)] : [{ type: 'ReturnStatement', argument: call }]
				)
			};
		})
	};
}
