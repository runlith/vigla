import type * as AST from '../ast.ts';
import { fail } from '../diagnostics.ts';
import { decode } from './decode.ts';
import { readExpression } from './expression.ts';
import { isWhitespace } from './html.ts';
import type { Identifier, Parser } from './parser.ts';

const unquotedEnd = /(\/>|[\s"'=<>`])/y;
const quote = /["']/y;
const staticValue = /(?:"([^"]*)"|'([^'])*'|([^>\s]+))/y;

export function isExpressionAttribute(
	attribute: AST.Attribute
): attribute is AST.Attribute & { value: AST.ExpressionTag | [AST.ExpressionTag] } {
	const value = attribute.value;
	return (
		value !== true &&
		(!Array.isArray(value) || (value.length === 1 && value[0]?.type === 'ExpressionTag'))
	);
}

export function attributeExpression(attribute: AST.Attribute): AST.Expression {
	const value = attribute.value as AST.ExpressionTag | AST.ExpressionTag[];
	return Array.isArray(value) ? (value[0] as AST.ExpressionTag).expression : value.expression;
}

function attribute(
	name: string,
	loc: AST.NameLocation | null,
	start: number,
	end: number,
	value: AST.AttributeValue
): AST.Attribute {
	return { type: 'Attribute', start, end, name, name_loc: loc, value };
}

export function readStaticAttribute(parser: Parser): AST.Attribute | null {
	const start = parser.index;
	const tag = readTag(parser, true);
	if (!tag.name) return null;
	let value: AST.AttributeValue = true;
	if (parser.eat('=')) {
		parser.allowWhitespace();
		let raw = parser.matchRegex(staticValue);
		if (!raw) fail('expected_attribute_value', parser.index);
		parser.index += raw.length;
		const quoted = raw[0] === '"' || raw[0] === "'";
		if (quoted) raw = raw.slice(1, -1);
		value = [
			{
				start: parser.index - raw.length - (quoted ? 1 : 0),
				end: quoted ? parser.index - 1 : parser.index,
				type: 'Text',
				raw,
				data: decode(raw, true)
			}
		];
	}
	if (parser.matchRegex(quote)) fail('expected_token', parser.index, { token: '=' });
	return attribute(tag.name, tag.loc, start, parser.index, value);
}

function readComment(parser: Parser): AST.JSComment | null {
	const start = parser.index;
	if (parser.eat('//')) {
		const value = parser.readUntil('\n');
		const end = parser.index;
		return { type: 'Line', start, end, value, loc: location(parser, start, end) };
	}
	if (parser.eat('/*')) {
		const value = parser.readUntil('*/');
		parser.eat('*/');
		const end = parser.index;
		return { type: 'Block', start, end, value, loc: location(parser, start, end) };
	}
	return null;
}

function location(parser: Parser, start: number, end: number): AST.NameLocation {
	return { start: parser.locate(start), end: parser.locate(end) };
}

const directives: Readonly<Record<string, AST.DirectiveType>> = {
	use: 'UseDirective',
	animate: 'AnimateDirective',
	bind: 'BindDirective',
	class: 'ClassDirective',
	on: 'OnDirective',
	let: 'LetDirective',
	in: 'TransitionDirective',
	out: 'TransitionDirective',
	transition: 'TransitionDirective'
};

function directiveType(prefix: string): AST.DirectiveType | 'StyleDirective' | null {
	if (prefix === 'style') return 'StyleDirective';
	return Object.hasOwn(directives, prefix) ? (directives[prefix] as AST.DirectiveType) : null;
}

export function readAttribute(parser: Parser): AST.AttributeLike | null {
	for (let comment = readComment(parser); comment !== null; comment = readComment(parser)) {
		parser.comments.push(comment);
		parser.allowWhitespace();
	}

	const start = parser.index;

	if (parser.eat('{')) {
		parser.allowWhitespace();
		if (parser.eat('@attach')) {
			parser.requireWhitespace();
			const expression = readExpression(parser);
			parser.allowWhitespace();
			parser.eat('}', true);
			return { type: 'AttachTag', start, end: parser.index, expression };
		}
		if (parser.eat('...')) {
			const expression = readExpression(parser);
			parser.allowWhitespace();
			parser.eat('}', true);
			return { type: 'SpreadAttribute', start, end: parser.index, expression };
		}
		const id = parser.readIdentifier();
		if (id.name === '') {
			if (
				parser.loose &&
				(parser.match('#') || parser.match('/') || parser.match('@') || parser.match(':'))
			) {
				return null;
			}
			if (!(parser.loose && parser.match('}'))) fail('attribute_empty_shorthand', start);
		}
		parser.allowWhitespace();
		parser.eat('}', true);
		const expression: AST.ExpressionTag = {
			type: 'ExpressionTag',
			start: id.start,
			end: id.end,
			expression: id as AST.Expression
		};
		return attribute(id.name, id.loc, start, parser.index, expression);
	}

	const tag = readTag(parser, true);
	if (!tag.name) return null;

	let end = parser.index;
	parser.allowWhitespace();

	const colon = tag.name.indexOf(':');
	const type = colon === -1 ? null : directiveType(tag.name.slice(0, colon));

	let value: AST.AttributeValue = true;
	if (parser.eat('=')) {
		parser.allowWhitespace();
		if (parser.template[parser.index] === '/' && parser.template[parser.index + 1] === '>') {
			const at = parser.index++;
			value = [{ start: at, end: at + 1, type: 'Text', raw: '/', data: '/' }];
		} else {
			value = readAttributeValue(parser);
		}
		end = parser.index;
	} else if (parser.matchRegex(quote)) {
		fail('expected_token', parser.index, { token: '=' });
	}

	if (type === null) return attribute(tag.name, tag.loc, start, end, value);

	const [name = '', ...modifiers] = tag.name.slice(colon + 1).split('|');
	if (name === '') {
		fail('directive_missing_name', { start, end: start + colon + 1 }, { type: tag.name });
	}

	if (type === 'StyleDirective') {
		return { start, end, type, name, name_loc: tag.loc, modifiers, value };
	}

	const first = value === true ? undefined : Array.isArray(value) ? value[0] : value;
	let expression: AST.Expression | null = null;
	if (first !== undefined) {
		if ((value as unknown[]).length > 1 || first.type === 'Text') {
			fail('directive_invalid_value', first.start);
		}
		expression = (first as AST.ExpressionTag).expression;
	}

	const directive: AST.Directive = {
		start,
		end,
		type,
		name,
		name_loc: tag.loc,
		expression,
		modifiers
	};
	if (type === 'TransitionDirective') {
		const direction = tag.name.slice(0, colon);
		directive.intro = direction === 'in' || direction === 'transition';
		directive.outro = direction === 'out' || direction === 'transition';
	}
	if ((type === 'BindDirective' || type === 'ClassDirective') && directive.expression === null) {
		directive.expression = {
			start: start + colon + 1,
			end,
			type: 'Identifier',
			name: directive.name
		} as AST.Expression;
	}
	return directive;
}

function readAttributeValue(parser: Parser): AST.ExpressionTag | (AST.Text | AST.ExpressionTag)[] {
	const mark = parser.eat("'") ? "'" : parser.eat('"') ? '"' : null;
	if (mark !== null && parser.eat(mark)) {
		return [{ start: parser.index - 1, end: parser.index - 1, type: 'Text', raw: '', data: '' }];
	}
	let value: (AST.Text | AST.ExpressionTag)[];
	try {
		value = readSequence(
			parser,
			() => (mark !== null ? parser.match(mark) : parser.matchRegex(unquotedEnd) !== null),
			'in attribute value'
		);
	} catch (error) {
		const diagnostic = (error as { diagnostic?: { code: string; start: number } }).diagnostic;
		if (diagnostic?.code === 'js_parse_error') {
			const at = diagnostic.start;
			if (parser.template.slice(at - 1, at + 1) === '/>') {
				parser.index = at;
				fail('expected_token', at, { token: mark ?? '}' });
			}
		}
		throw error;
	}
	if (value.length === 0 && mark === null) fail('expected_attribute_value', parser.index);
	if (mark !== null) parser.index += 1;
	if (mark !== null || value.length > 1 || value[0]?.type === 'Text') return value;
	return value[0] as AST.ExpressionTag;
}

export function readSequence(
	parser: Parser,
	done: () => boolean,
	where: string
): (AST.Text | AST.ExpressionTag)[] {
	const chunks: (AST.Text | AST.ExpressionTag)[] = [];
	let chunkStart = parser.index;
	const flush = (end: number): void => {
		if (end > chunkStart) {
			const raw = parser.template.slice(chunkStart, end);
			chunks.push({ start: chunkStart, end, type: 'Text', raw, data: decode(raw, true) });
		}
	};
	while (parser.index < parser.template.length) {
		const index = parser.index;
		if (done()) {
			flush(parser.index);
			return chunks;
		}
		if (parser.eat('{')) {
			if (parser.match('#')) {
				const at = parser.index - 1;
				parser.eat('#');
				fail('block_invalid_placement', at, { name: lowercaseName(parser), location: where });
			} else if (parser.match('@')) {
				const at = parser.index - 1;
				parser.eat('@');
				fail('tag_invalid_placement', at, { name: lowercaseName(parser), location: where });
			}
			flush(parser.index - 1);
			parser.allowWhitespace();
			const expression = readExpression(parser);
			parser.allowWhitespace();
			parser.eat('}', true);
			chunks.push({ type: 'ExpressionTag', start: index, end: parser.index, expression });
			chunkStart = parser.index;
		} else {
			parser.index++;
		}
	}
	if (parser.loose) return chunks;
	fail('unexpected_eof', parser.template.length);
}

export function readTagName(parser: Parser, attribute = false): string {
	const start = parser.index;
	if (start >= parser.template.length && !parser.loose)
		fail('unexpected_eof', parser.template.length);
	while (parser.index < parser.template.length) {
		const code = parser.template.charCodeAt(parser.index);
		if (
			isWhitespace(code) ||
			code === 47 ||
			code === 62 ||
			(attribute && (code === 34 || code === 39 || code === 61))
		) {
			break;
		}
		parser.index += 1;
	}
	return parser.template.slice(start, parser.index);
}

export function readTag(parser: Parser, attribute = false): Identifier {
	const start = parser.index;
	const name = readTagName(parser, attribute);
	const end = parser.index;
	return { type: 'Identifier', name, start, end, loc: location(parser, start, end) };
}

function lowercaseName(parser: Parser): string {
	const start = parser.index;
	while (parser.index < parser.template.length) {
		const code = parser.template.charCodeAt(parser.index);
		if (code < 97 || code > 122) break;
		parser.index += 1;
	}
	return parser.template.slice(start, parser.index);
}
