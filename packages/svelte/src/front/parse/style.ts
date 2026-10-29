import type * as AST from '../ast.ts';
import { fail } from '../diagnostics.ts';
import type { Scanner } from './parser.ts';

type Css = AST.Css.Rule | AST.Css.Atrule;

const matcher = /[~^$*|]?=/y;
const closingBracket = /[\s\]]/;
const flagsPattern = /[a-zA-Z]+/y;
const combinatorPattern = /(\+|~|>|\|\|)/y;
const percentage = /\d+(\.\d+)?%/y;
const nthOf =
	/(even|odd|\+?(\d+|\d*n(\s*[+-]\s*\d+)?)|-\d*n(\s*\+\s*\d+))((?=\s*[,)])|\s+of(\s+|(?=[.#[*:&])))/y;
const whitespaceOrColon = /[\s:]/;
const leadingHyphenOrDigit = /-?\d/y;
const identifierChar = /[a-zA-Z0-9_-]/;
const unicodeSequence = /\\[0-9a-fA-F]{1,6}(\r\n|\s)?/y;
const styleEnd = /\s*>/y;

export function readStyle(
	scanner: Scanner,
	start: number,
	attributes: AST.AttributeLike[]
): AST.Css.StyleSheet {
	const contentStart = scanner.index;
	scanner.cssComments = [];
	const children = readBody(
		scanner,
		() => scanner.match('</style') || scanner.index >= scanner.template.length
	);
	const contentEnd = scanner.index;
	scanner.eat('</style', true);
	scanner.read(styleEnd);
	return {
		type: 'StyleSheet',
		start,
		end: scanner.index,
		attributes,
		children,
		comments: scanner.cssComments,
		content: {
			start: contentStart,
			end: contentEnd,
			styles: scanner.template.slice(contentStart, contentEnd),
			comment: null
		}
	};
}

export function readStylesheet(scanner: Scanner): Css[] {
	return readBody(scanner, () => scanner.index >= scanner.template.length);
}

function readBody(scanner: Scanner, finished: () => boolean): Css[] {
	const children: Css[] = [];
	for (;;) {
		skipTrivia(scanner);
		if (finished()) return children;
		children.push(scanner.match('@') ? readAtrule(scanner) : readRule(scanner));
	}
}

function readAtrule(scanner: Scanner): AST.Css.Atrule {
	const start = scanner.index;
	scanner.eat('@', true);
	const name = readIdentifier(scanner);
	const prelude = readValue(scanner);
	let block: AST.Css.Block | null = null;
	if (scanner.match('{')) block = readBlock(scanner);
	else scanner.eat(';', true);
	return { type: 'Atrule', start, end: scanner.index, name, prelude, block };
}

function readRule(scanner: Scanner): AST.Css.Rule {
	const start = scanner.index;
	const prelude = readSelectorList(scanner);
	const block = readBlock(scanner);
	return { type: 'Rule', prelude, block, start, end: scanner.index };
}

function readSelectorList(scanner: Scanner, inPseudo = false): AST.Css.SelectorList {
	const children: AST.Css.ComplexSelector[] = [];
	skipTrivia(scanner);
	const start = scanner.index;
	while (scanner.index < scanner.template.length) {
		children.push(readSelector(scanner, inPseudo));
		const end = scanner.index;
		skipTrivia(scanner);
		if (inPseudo ? scanner.match(')') : scanner.match('{')) {
			return { type: 'SelectorList', start, end, children };
		}
		scanner.eat(',', true);
		skipTrivia(scanner);
	}
	fail('unexpected_eof', scanner.template.length);
}

function relative(combinator: AST.Css.Combinator | null, start: number): AST.Css.RelativeSelector {
	return { type: 'RelativeSelector', combinator, selectors: [], start, end: -1 };
}

function readTypeName(scanner: Scanner, first: string, start: number): AST.Css.TypeSelector {
	let name = first;
	let namespace: string | undefined;
	if (scanner.eat('|')) {
		namespace = name;
		name = scanner.eat('*') ? '*' : readIdentifier(scanner);
	}
	return namespace === undefined
		? { type: 'TypeSelector', name, start, end: scanner.index }
		: { type: 'TypeSelector', name, namespace, start, end: scanner.index };
}

function readSelector(scanner: Scanner, inPseudo: boolean): AST.Css.ComplexSelector {
	const listStart = scanner.index;
	const children: AST.Css.RelativeSelector[] = [];
	let current = relative(null, scanner.index);

	while (scanner.index < scanner.template.length) {
		const start = scanner.index;
		if (scanner.eat('&')) {
			current.selectors.push({ type: 'NestingSelector', name: '&', start, end: scanner.index });
		} else if (scanner.eat('*')) {
			current.selectors.push(readTypeName(scanner, '*', start));
		} else if (scanner.eat('#')) {
			current.selectors.push({
				type: 'IdSelector',
				name: readIdentifier(scanner),
				start,
				end: scanner.index
			});
		} else if (scanner.eat('.')) {
			current.selectors.push({
				type: 'ClassSelector',
				name: readIdentifier(scanner),
				start,
				end: scanner.index
			});
		} else if (scanner.eat('::')) {
			const name = readIdentifier(scanner);
			let args: AST.Css.SelectorList | null = null;
			if (scanner.eat('(')) {
				args = readSelectorList(scanner, true);
				scanner.eat(')', true);
			}
			current.selectors.push(
				args === null
					? { type: 'PseudoElementSelector', name, start, end: scanner.index }
					: { type: 'PseudoElementSelector', name, start, end: scanner.index, args }
			);
		} else if (scanner.eat(':')) {
			const name = readIdentifier(scanner);
			let args: AST.Css.SelectorList | null = null;
			if (scanner.eat('(')) {
				args = readSelectorList(scanner, true);
				scanner.eat(')', true);
			}
			current.selectors.push({
				type: 'PseudoClassSelector',
				name,
				args,
				start,
				end: scanner.index
			});
		} else if (scanner.eat('[')) {
			scanner.allowWhitespace();
			const name = readIdentifier(scanner);
			scanner.allowWhitespace();
			let value: string | null = null;
			const matched = scanner.read(matcher);
			if (matched) {
				scanner.allowWhitespace();
				value = readAttributeValue(scanner);
			}
			scanner.allowWhitespace();
			const flags = scanner.read(flagsPattern);
			scanner.allowWhitespace();
			scanner.eat(']', true);
			current.selectors.push({
				type: 'AttributeSelector',
				start,
				end: scanner.index,
				name,
				matcher: matched,
				value,
				flags
			});
		} else if (inPseudo && scanner.matchRegex(nthOf)) {
			current.selectors.push({
				type: 'Nth',
				value: scanner.read(nthOf) as string,
				start,
				end: scanner.index
			});
		} else if (scanner.matchRegex(percentage)) {
			current.selectors.push({
				type: 'Percentage',
				value: scanner.read(percentage) as string,
				start,
				end: scanner.index
			});
		} else if (!scanner.matchRegex(combinatorPattern)) {
			current.selectors.push(readTypeName(scanner, readIdentifier(scanner), start));
		}

		const index = scanner.index;
		skipTrivia(scanner, false);
		if (scanner.match(',') || (inPseudo ? scanner.match(')') : scanner.match('{'))) {
			scanner.index = index;
			current.end = index;
			children.push(current);
			return { type: 'ComplexSelector', start: listStart, end: index, children };
		}
		scanner.index = index;
		const combinator = readCombinator(scanner);
		if (combinator !== null) {
			if (current.selectors.length > 0) {
				current.end = index;
				children.push(current);
			}
			current = relative(combinator, combinator.start);
			scanner.allowWhitespace();
			if (scanner.match(',') || (inPseudo ? scanner.match(')') : scanner.match('{'))) {
				fail('css_selector_invalid', scanner.index);
			}
		}
	}
	fail('unexpected_eof', scanner.template.length);
}

function readCombinator(scanner: Scanner): AST.Css.Combinator | null {
	const start = scanner.index;
	scanner.allowWhitespace();
	const index = scanner.index;
	const name = scanner.read(combinatorPattern);
	if (name) {
		const end = scanner.index;
		scanner.allowWhitespace();
		return { type: 'Combinator', name, start: index, end };
	}
	if (scanner.index !== start) return { type: 'Combinator', name: ' ', start, end: scanner.index };
	return null;
}

function readBlock(scanner: Scanner): AST.Css.Block {
	const start = scanner.index;
	scanner.eat('{', true);
	const children: (AST.Css.Declaration | AST.Css.Rule | AST.Css.Atrule)[] = [];
	while (scanner.index < scanner.template.length) {
		skipTrivia(scanner);
		if (scanner.match('}')) break;
		children.push(readBlockItem(scanner));
	}
	scanner.eat('}', true);
	return { type: 'Block', start, end: scanner.index, children };
}

function readBlockItem(scanner: Scanner): AST.Css.Declaration | AST.Css.Rule | AST.Css.Atrule {
	if (scanner.match('@')) return readAtrule(scanner);
	const start = scanner.index;
	readValue(scanner, false);
	const char = scanner.template[scanner.index];
	scanner.index = start;
	return char === '{' ? readRule(scanner) : readDeclaration(scanner);
}

function readDeclaration(scanner: Scanner): AST.Css.Declaration {
	const start = scanner.index;
	const property = scanner.readUntilRegex(whitespaceOrColon);
	scanner.allowWhitespace();
	scanner.eat(':');
	const index = scanner.index;
	scanner.allowWhitespace();
	const value = readValue(scanner);
	if (!value && !property.startsWith('--')) fail('css_empty_declaration', { start, end: index });
	const end = scanner.index;
	if (!scanner.match('}')) scanner.eat(';', true);
	return { type: 'Declaration', start, end, property, value };
}

function readValue(scanner: Scanner, capture = true): string {
	let value = '';
	const comments: AST.Css.Comment[] = [];
	let escaped = false;
	let inUrl = false;
	let mark: string | null = null;
	while (scanner.index < scanner.template.length) {
		const char = scanner.template[scanner.index] as string;
		if (escaped) {
			value += `\\${char}`;
			escaped = false;
			scanner.index++;
			continue;
		}
		if (char === '\\') {
			escaped = true;
			scanner.index++;
			continue;
		}
		if (char === mark) {
			mark = null;
		} else if (char === ')') {
			inUrl = false;
		} else if (mark === null && (char === '"' || char === "'")) {
			mark = char;
		} else if (char === '(' && value.slice(-3) === 'url') {
			inUrl = true;
		} else if ((char === ';' || char === '{' || char === '}') && !inUrl && !mark) {
			const leading = value.length - value.trimStart().length;
			for (const comment of comments) {
				comment.position = Math.max(0, (comment.position as number) - leading);
			}
			return value.trim();
		} else if (char === '/' && !inUrl && !mark && scanner.template[scanner.index + 1] === '*') {
			const comment = readComment(scanner);
			if (capture) {
				comment.position = value.length;
				scanner.cssComments.push(comment);
				comments.push(comment);
			}
			continue;
		}
		value += char;
		scanner.index++;
	}
	fail('unexpected_eof', scanner.template.length);
}

function readAttributeValue(scanner: Scanner): string {
	let value = '';
	let escaped = false;
	const mark = scanner.eat('"') ? '"' : scanner.eat("'") ? "'" : null;
	while (scanner.index < scanner.template.length) {
		const char = scanner.template[scanner.index] as string;
		if (escaped) {
			value += `\\${char}`;
			escaped = false;
		} else if (char === '\\') {
			escaped = true;
		} else if (mark !== null ? char === mark : closingBracket.test(char)) {
			if (mark !== null) scanner.eat(mark, true);
			return value.trim();
		} else {
			value += char;
		}
		scanner.index++;
	}
	fail('unexpected_eof', scanner.template.length);
}

function readIdentifier(scanner: Scanner): string {
	const start = scanner.index;
	let identifier = '';
	if (scanner.matchRegex(leadingHyphenOrDigit)) fail('css_expected_identifier', start);
	while (scanner.index < scanner.template.length) {
		const char = scanner.template[scanner.index] as string;
		if (char === '\\') {
			const sequence = scanner.matchRegex(unicodeSequence);
			if (sequence) {
				const decoded = String.fromCodePoint(parseInt(sequence.slice(1), 16));
				identifier += decoded === '\\' ? '\\\\' : decoded;
				scanner.index += sequence.length;
			} else {
				identifier += `\\${scanner.template[scanner.index + 1]}`;
				scanner.index += 2;
			}
		} else if ((char.codePointAt(0) as number) >= 160 || identifierChar.test(char)) {
			identifier += char;
			scanner.index++;
		} else {
			break;
		}
	}
	if (identifier === '') fail('css_expected_identifier', start);
	return identifier;
}

function skipTrivia(scanner: Scanner, capture = true): void {
	scanner.allowWhitespace();
	while (scanner.match('/*') || scanner.match('<!--')) {
		if (scanner.match('/*')) {
			const comment = readComment(scanner);
			if (capture) scanner.cssComments.push(comment);
		}
		if (scanner.eat('<!--')) {
			scanner.readUntil('-->');
			scanner.eat('-->', true);
		}
		scanner.allowWhitespace();
	}
}

function readComment(scanner: Scanner): AST.Css.Comment {
	const start = scanner.index;
	scanner.eat('/*', true);
	const value = scanner.readUntil('*/');
	scanner.eat('*/', true);
	return { type: 'CSSComment', value, start, end: scanner.index };
}
