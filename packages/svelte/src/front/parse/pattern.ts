import type * as AST from '../ast.ts';
import { fail } from '../diagnostics.ts';
import { matchBracket } from './bracket.ts';
import { parseExpressionAt, removeParens, type Node } from './js.ts';
import type { Parser } from './parser.ts';

export function readPattern(parser: Parser): AST.Pattern {
	const start = parser.index;
	const id = parser.readIdentifier();
	if (id.name !== '') {
		return { ...id, typeAnnotation: readTypeAnnotation(parser) } as AST.Pattern;
	}
	const char = parser.template[start];
	if (char !== '{' && char !== '[') fail('expected_pattern', start);
	const end = matchBracket(parser.template, start);
	parser.index = end;
	const assignment = removeParens(
		parseExpressionAt(parser, `${parser.template.slice(0, end)} = 1`, start)
	);
	const pattern = assignment.left as Node;
	pattern.typeAnnotation = readTypeAnnotation(parser);
	if (pattern.typeAnnotation) pattern.end = (pattern.typeAnnotation as Node).end;
	return pattern as unknown as AST.Pattern;
}

const optionalColon = /\?\s*:/g;

function readTypeAnnotation(parser: Parser): Node | undefined {
	const start = parser.index;
	parser.allowWhitespace();
	if (!parser.eat(':')) {
		parser.index = start;
		return undefined;
	}
	const insert = '_ as ';
	const from = parser.index - insert.length;
	const template =
		parser.template.slice(0, from) +
		insert +
		parser.template.slice(parser.index).replace(optionalColon, ':');
	let expression = removeParens(parseExpressionAt(parser, template, from));
	if (expression.type === 'AssignmentExpression') {
		let equals = (expression.right as Node).start;
		while (template[equals] !== '=') equals -= 1;
		expression = removeParens(parseExpressionAt(parser, template.slice(0, equals), from));
	}
	if (expression.type === 'SequenceExpression') {
		expression = (expression.expressions as Node[])[0] as Node;
	}
	parser.index = expression.end;
	return {
		type: 'TSTypeAnnotation',
		start,
		end: parser.index,
		typeAnnotation: expression.typeAnnotation
	} as unknown as Node;
}
