import type * as ES from 'estree';
import { spanOf, unsupported } from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import { rewrite, runtime } from './script.ts';
import type { TemplateContext } from './template.ts';

interface Path {
	readonly name: ES.Identifier;
	readonly value: ES.Expression;
	readonly defaulted: boolean;
}

function step(base: ES.Expression, key: ES.Expression, computed: boolean): ES.Expression {
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

function collect(
	context: TemplateContext,
	pattern: ES.Pattern,
	base: ES.Expression,
	defaulted: boolean,
	paths: Path[],
	inserts: ES.Statement[]
): void {
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
			collect(context, pattern.left, fallback, true, paths, inserts);
			return;
		}
		case 'ObjectPattern': {
			const keys: ES.Expression[] = [];
			for (const property of pattern.properties) {
				if (property.type === 'RestElement') {
					const rest = runtime(context, 'rest', base, {
						type: 'ArrayExpression',
						elements: keys
					});
					collect(context, property.argument, rest, defaulted, paths, inserts);
					continue;
				}
				const { key, computed } = keyOf(property);
				keys.push(computed ? key : b.literal((key as ES.Identifier).name));
				collect(context, property.value, step(base, key, computed), defaulted, paths, inserts);
			}
			return;
		}
		case 'ArrayPattern': {
			const array = b.id(context.names.unique('$$array'));
			inserts.push(
				b.constant(
					array.name,
					runtime(
						context,
						'derived',
						b.arrow([], runtime(context, 'toArray', base, b.literal(pattern.elements.length)))
					)
				)
			);
			const current = runtime(context, 'get', array);
			pattern.elements.forEach((element, index) => {
				if (element === null) return;
				if (element.type === 'RestElement') {
					const rest = b.call(b.member(current, 'slice'), b.literal(index));
					collect(context, element.argument, rest, defaulted, paths, inserts);
					return;
				}
				collect(context, element, step(current, b.literal(index), true), defaulted, paths, inserts);
			});
			return;
		}
		default:
			throw unsupported(spanOf(pattern), 'This snippet parameter pattern');
	}
}

export function snippetParameters(
	context: TemplateContext,
	parameters: readonly ES.Pattern[]
): { params: ES.Pattern[]; declarations: ES.Statement[] } {
	const params: ES.Pattern[] = [];
	const declarations: ES.Statement[] = [];
	parameters.forEach((parameter, index) => {
		if (parameter.type === 'Identifier') {
			params.push({
				type: 'AssignmentPattern',
				left: parameter,
				right: b.member(context.runtime, 'noop')
			});
			return;
		}
		const argument = b.id(context.names.unique(`$$arg${index}`));
		params.push(argument);
		const base: ES.Expression = {
			type: 'ChainExpression',
			expression: { type: 'CallExpression', callee: argument, arguments: [], optional: true }
		};
		const paths: Path[] = [];
		collect(context, parameter, base, false, paths, declarations);
		for (const path of paths) {
			const thunk = b.arrow([], path.value);
			declarations.push(
				b.constant(path.name.name, path.defaulted ? runtime(context, 'derived', thunk) : thunk)
			);
		}
	});
	return { params, declarations };
}
