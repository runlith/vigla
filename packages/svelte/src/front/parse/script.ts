import type * as AST from '../ast.ts';
import { fail } from '../diagnostics.ts';
import { parseScript } from './js.ts';
import type { Parser } from './parser.ts';

const closing = /<\/script\s*>/;
const closingHere = /<\/script\s*>/y;
const notNewline = /[^\n]/g;

const reserved = new Set(['server', 'client', 'worker', 'test', 'default']);
const allowed = new Set(['context', 'generics', 'lang', 'module']);

export function readScript(
	parser: Parser,
	start: number,
	attributes: AST.AttributeLike[]
): AST.Script {
	const contentStart = parser.index;
	const data = parser.readUntilRegex(closing);
	if (parser.index >= parser.template.length) {
		fail('element_unclosed', parser.template.length, { name: 'script' });
	}
	const source = parser.template.slice(0, contentStart).replace(notNewline, ' ') + data;
	parser.read(closingHere);

	const ast = parseScript(source, parser.comments, parser.ts);
	ast.start = contentStart;
	const loc = ast.loc as {
		start: { line: number; column: number };
		end: { line: number; column: number };
	};
	const from = parser.locate(start);
	const to = parser.locate(parser.index);
	loc.start.line = from.line;
	loc.start.column = from.column;
	loc.end.line = to.line;
	loc.end.column = to.column;

	let context: 'default' | 'module' = 'default';
	for (const attribute of attributes as AST.Attribute[]) {
		if (reserved.has(attribute.name)) {
			fail('script_reserved_attribute', attribute, { name: attribute.name });
		}
		if (!allowed.has(attribute.name)) parser.warn('script_unknown_attribute', attribute);
		if (attribute.name === 'module') {
			if (attribute.value !== true) {
				fail('script_invalid_attribute_value', attribute, { name: attribute.name });
			}
			context = 'module';
		}
		if (attribute.name === 'context') {
			const value = attribute.value;
			if (
				value === true ||
				!Array.isArray(value) ||
				value.length !== 1 ||
				value[0]?.type !== 'Text'
			) {
				fail('script_invalid_context', attribute);
			}
			if (value[0].data !== 'module') fail('script_invalid_context', attribute);
			context = 'module';
		}
	}

	return {
		type: 'Script',
		start,
		end: parser.index,
		context,
		content: ast as unknown as AST.Script['content'],
		attributes
	};
}
