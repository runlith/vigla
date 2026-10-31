import type * as ES from 'estree';
import { hasAwait, isSignal, spanOf, unsupported } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type { Rune } from '../ir/port.ts';
import { declare, primitive, rewrite, runtime, type Context } from './script.ts';
import { tagged } from './inspect.ts';

export interface Path {
	readonly name: ES.Identifier;
	readonly value: ES.Expression;
	readonly defaulted: boolean;
}

export interface Extraction {
	readonly context: Context;
	readonly optional: boolean;
	readonly paths: Path[];
	readonly inserts: ES.Statement[];
}

function step(
	extraction: Extraction,
	base: ES.Expression,
	key: ES.Expression,
	computed: boolean
): ES.Expression {
	if (!extraction.optional) {
		return { type: 'MemberExpression', object: base, property: key, computed, optional: false };
	}
	const inner = base.type === 'ChainExpression' ? base.expression : base;
	const member: ES.MemberExpression = {
		type: 'MemberExpression',
		object: inner as ES.Expression,
		property: key,
		computed,
		optional: true
	};
	return { type: 'ChainExpression', expression: member };
}

function keyOf(property: ES.Property): { key: ES.Expression; computed: boolean } {
	if (property.computed) return { key: property.key as ES.Expression, computed: true };
	if (property.key.type === 'Identifier') return { key: b.id(property.key.name), computed: false };
	return { key: property.key as ES.Expression, computed: true };
}

export function extract(
	extraction: Extraction,
	pattern: ES.Pattern,
	base: ES.Expression,
	defaulted = false
): void {
	const { context, paths, inserts } = extraction;
	switch (pattern.type) {
		case 'Identifier':
			paths.push({ name: pattern, value: base, defaulted });
			return;
		case 'AssignmentPattern': {
			const fallback = runtime(
				context,
				'fallback',
				base,
				b.arrow([], rewrite(context, pattern.right))
			);
			extract(extraction, pattern.left, fallback, true);
			return;
		}
		case 'ObjectPattern': {
			const keys: ES.Expression[] = [];
			for (const property of pattern.properties) {
				if (property.type === 'RestElement') {
					const rest = runtime(context, 'exclude', base, {
						type: 'ArrayExpression',
						elements: keys
					});
					extract(extraction, property.argument, rest, defaulted);
					continue;
				}
				const { key, computed } = keyOf(property);
				keys.push(computed ? rewrite(context, key) : b.literal((key as ES.Identifier).name));
				const member = computed ? rewrite(context, key) : key;
				extract(extraction, property.value, step(extraction, base, member, computed), defaulted);
			}
			return;
		}
		case 'ArrayPattern': {
			const array = b.id(context.names.unique('$$array'));
			const rested = pattern.elements.at(-1)?.type === 'RestElement';
			const args = rested ? [base] : [base, b.literal(pattern.elements.length)];
			inserts.push(
				b.constant(
					array.name,
					runtime(context, 'derived', b.arrow([], runtime(context, 'toArray', ...args)))
				)
			);
			const current = runtime(context, 'get', array);
			pattern.elements.forEach((element, index) => {
				if (element === null) return;
				if (element.type === 'RestElement') {
					const rest = b.call(b.member(current, 'slice'), b.literal(index));
					extract(extraction, element.argument, rest, defaulted);
					return;
				}
				extract(extraction, element, step(extraction, current, b.literal(index), true), defaulted);
			});
			return;
		}
		default:
			throw unsupported(spanOf(pattern), 'This destructuring pattern');
	}
}

export function destructured(
	context: Context,
	rune: Rune,
	pattern: ES.Pattern,
	init: ES.CallExpression,
	next: <T extends ES.Node>(node: T) => T
): ES.VariableDeclarator[] {
	const result: ES.VariableDeclarator[] = [];
	const hold = (name: string, value: ES.Expression): ES.Identifier => {
		const id = b.id(context.names.unique(name));
		result.push({ type: 'VariableDeclarator', id, init: value });
		return id;
	};
	const given = init.arguments[0] as ES.Expression | undefined;
	const state = rune === '$state' || rune === '$state.raw';
	let base: ES.Expression;
	if (state) base = hold('tmp', given === undefined ? b.id('undefined') : next(given));
	else if (rune === '$derived' && given?.type === 'Identifier' && !hasAwait(given))
		base = next(given);
	else base = runtime(context, 'get', hold('$$d', declare(context, rune, undefined, init, next)));
	const extraction: Extraction = { context, optional: false, paths: [], inserts: [] };
	extract(extraction, pattern, base);
	for (const insert of extraction.inserts)
		result.push(...(insert as ES.VariableDeclaration).declarations);
	for (const path of extraction.paths) {
		let value = path.value;
		if (state) {
			const binding = context.analysis.declarations.get(path.name);
			if (rune === '$state' && !primitive(value)) value = runtime(context, 'proxy', value);
			if (binding !== undefined && isSignal(binding)) value = runtime(context, 'state', value);
		} else {
			value = runtime(context, 'derived', b.arrow([], value));
		}
		const binding = context.analysis.declarations.get(path.name);
		result.push({
			type: 'VariableDeclarator',
			id: path.name,
			init: tagged(context, value, path.name.name, binding !== undefined && isSignal(binding))
		});
	}
	return result;
}
