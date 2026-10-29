import type * as AST from '../ast.ts';
import { findMatchingBracket } from './bracket.ts';
import { isReserved } from './html.ts';
import { identifierEnd as wordEnd } from './identifier.ts';
import { lfLineBreaksOnly, parseExpressionAt, removeParens } from './js.ts';
import type { Parser } from './parser.ts';

export function looseIdentifier(parser: Parser, open?: string): AST.Expression | undefined {
	const end = findMatchingBracket(parser.template, parser.index, open ?? '{');
	if (!end) return undefined;
	const start = parser.index;
	parser.index = end;
	return { type: 'Identifier', start, end, name: '' } as AST.Expression;
}

export function readExpression(parser: Parser, open?: string, strict?: boolean): AST.Expression {
	const simple = readSimple(parser);
	if (simple !== null) return simple;
	try {
		const node = parseExpressionAt(parser, parser.template, parser.index);
		let index = node.end;
		const last = parser.comments.at(-1);
		if (last !== undefined && last.end > index) index = last.end;
		parser.index = index;
		return removeParens(node) as unknown as AST.Expression;
	} catch (error) {
		if (parser.loose && !strict) {
			const expression = looseIdentifier(parser, open);
			if (expression !== undefined) return expression;
		}
		throw error;
	}
}

function readSimple(parser: Parser): AST.Expression | null {
	if (!lfLineBreaksOnly(parser.template)) return null;
	const template = parser.template;
	const index = parser.index;
	parser.allowWhitespace();
	const start = parser.index;
	let end = wordEnd(template, start);
	if (end === -1 || isReserved(template.slice(start, end))) {
		parser.index = index;
		return null;
	}
	const position = (offset: number): { line: number; column: number } => {
		const { line, column } = parser.locate(offset);
		return { line, column };
	};
	const identifier = (from: number, to: number): AST.Expression =>
		({
			type: 'Identifier',
			start: from,
			end: to,
			loc: { start: position(from), end: position(to) },
			name: template.slice(from, to)
		}) as AST.Expression;
	let node = identifier(start, end);
	while (template[end] === '.') {
		const propertyEnd = wordEnd(template, end + 1);
		if (propertyEnd === -1) {
			parser.index = index;
			return null;
		}
		node = {
			type: 'MemberExpression',
			start,
			end: propertyEnd,
			loc: { start: position(start), end: position(propertyEnd) },
			object: node,
			property: identifier(end + 1, propertyEnd),
			computed: false,
			optional: false
		} as AST.Expression;
		end = propertyEnd;
	}
	parser.index = end;
	parser.allowWhitespace();
	if (!parser.match('}')) {
		parser.index = index;
		return null;
	}
	parser.index = end;
	return node;
}
