import type * as ES from 'estree';
import type * as AST from '../ast.ts';
import { fail } from '../diagnostics.ts';
import { findMatchingBracket, matchBracket } from './bracket.ts';
import { looseIdentifier, readExpression } from './expression.ts';
import { parseExpressionAt, parseStatementAt, type Node } from './js.ts';
import { fragment, type Parser } from './parser.ts';
import { readPattern } from './pattern.ts';

const closingBrace = /\s*}/y;
const supportedDeclaration = /(?:let|const)\b/y;
const unsupportedDeclaration = /(?:var|interface|enum)\b/y;
const maybeType = /type\b/y;
const pointy = { '<': '>' };

export function tag(parser: Parser): void {
	const start = parser.index;
	parser.index += 1;
	parser.allowWhitespace();

	if (parser.eat('#')) return open(parser);
	if (parser.eat(':')) return next(parser);
	if (parser.eat('@')) return special(parser);
	if (parser.match('/') && !parser.match('/*') && !parser.match('//')) {
		parser.eat('/');
		return close(parser);
	}

	const declaration = readDeclaration(parser);
	if (declaration !== null) {
		parser.append({ type: 'DeclarationTag', start, end: parser.index, declaration });
		return;
	}

	const expression = readExpression(parser);
	parser.allowWhitespace();
	parser.eat('}', true);
	parser.append({ type: 'ExpressionTag', start, end: parser.index, expression });
}

function readDeclaration(parser: Parser): AST.DeclarationTag['declaration'] | null {
	const start = parser.index;
	const unsupported = parser.matchRegex(unsupportedDeclaration);
	if (unsupported) {
		fail('declaration_tag_invalid_type', { start, end: start + unsupported.length });
	}
	if (!parser.matchRegex(supportedDeclaration) && !parser.matchRegex(maybeType)) return null;

	const commentCount = parser.comments.length;
	let declaration: Node;
	try {
		declaration = parseStatementAt(parser, parser.template, start);
	} catch (error) {
		if (!parser.loose) throw error;
		const end = findMatchingBracket(parser.template, start, '{');
		if (end === undefined) throw error;
		parser.index = end;
		declaration = {
			type: 'VariableDeclaration',
			kind: parser.template.startsWith('const', start) ? 'const' : 'let',
			declarations: [
				{
					type: 'VariableDeclarator',
					id: { type: 'Identifier', name: '', start: parser.index, end: parser.index },
					init: null,
					start: parser.index,
					end: parser.index
				}
			],
			start,
			end
		} as unknown as Node;
	}

	if (declaration.type !== 'VariableDeclaration') {
		if (declaration.type === 'ExpressionStatement') {
			parser.comments.length = commentCount;
			return null;
		}
		fail('declaration_tag_invalid_type', {
			start: declaration.start ?? start,
			end: declaration.end ?? parser.index
		});
	}
	const kind = (declaration as unknown as ES.VariableDeclaration).kind;
	if (kind !== 'let' && kind !== 'const') fail('declaration_tag_invalid_type', declaration);

	parser.index = declaration.end;
	parser.allowWhitespace();
	parser.eat('}', true);
	return declaration as unknown as AST.DeclarationTag['declaration'];
}

function blockStart(parser: Parser, from: number): number {
	let start = from;
	while (parser.template[start] !== '{') start -= 1;
	return start;
}

function open(parser: Parser): void {
	const start = blockStart(parser, parser.index - 2);

	if (parser.eat('if')) {
		parser.requireWhitespace();
		const block = parser.append<AST.IfBlock>({
			type: 'IfBlock',
			elseif: false,
			start,
			end: -1,
			test: readExpression(parser),
			consequent: fragment(),
			alternate: null
		});
		parser.allowWhitespace();
		parser.eat('}', true);
		parser.push(block, block.consequent);
		return;
	}

	if (parser.eat('each')) return each(parser, start);

	if (parser.eat('await')) return awaitBlock(parser, start);

	if (parser.eat('key')) {
		parser.requireWhitespace();
		const expression = readExpression(parser);
		parser.allowWhitespace();
		parser.eat('}', true);
		const block = parser.append<AST.KeyBlock>({
			type: 'KeyBlock',
			start,
			end: -1,
			expression,
			fragment: fragment()
		});
		parser.push(block, block.fragment);
		return;
	}

	if (parser.eat('snippet')) return snippet(parser, start);

	fail('expected_block_type', parser.index);
}

function each(parser: Parser, start: number): void {
	parser.requireWhitespace();
	const template = parser.template;
	let end = parser.template.length;
	let expression: AST.Expression | undefined;

	while (expression === undefined) {
		try {
			expression = readExpression(parser, undefined, true);
		} catch (error) {
			const diagnostic = (error as { diagnostic?: { start: number } }).diagnostic;
			if (diagnostic === undefined) throw error;
			end = diagnostic.start - 2;
			while (end > start && parser.template.slice(end, end + 2) !== 'as') end -= 1;
			if (end <= start) {
				if (parser.loose) {
					expression = looseIdentifier(parser);
					if (expression !== undefined) break;
				}
				throw error;
			}
			parser.template = template.slice(0, end);
		}
	}
	parser.template = template;
	parser.allowWhitespace();

	if (!parser.match('as')) {
		if (expression.type === 'SequenceExpression') {
			expression = expression.expressions[0] as AST.Expression;
		}
		const whole = expression;
		let assertion: Node | null = null;
		let to = whole.end as number;
		expression = stripAssertion(whole as unknown as Node, whole.end as number, (node) => {
			assertion = node;
			to = (node.expression as Node).end;
		}) as unknown as AST.Expression;
		expression.end = to;
		if (assertion !== null) {
			let at = ((assertion as Node).typeAnnotation as Node).start - 2;
			while (parser.template.slice(at, at + 2) !== 'as') at -= 1;
			parser.index = at;
		}
	}

	let context: AST.Pattern | null = null;
	let index: string | undefined;
	let key: AST.Expression | undefined;

	if (parser.eat('as')) {
		parser.requireWhitespace();
		context = readPattern(parser);
	} else {
		parser.index = expression.end as number;
	}

	parser.allowWhitespace();
	if (parser.eat(',')) {
		parser.allowWhitespace();
		index = parser.readIdentifier().name;
		if (!index) fail('expected_identifier', parser.index);
		parser.allowWhitespace();
	}

	if (parser.eat('(')) {
		parser.allowWhitespace();
		key = readExpression(parser, '(');
		parser.allowWhitespace();
		parser.eat(')', true);
		parser.allowWhitespace();
	}

	if (!parser.eat('}', true, false)) {
		if (parser.template.slice(parser.index - 4, parser.index) === ' as ') {
			const previous = parser.index;
			context = readPattern(parser);
			parser.eat('}', true);
			expression = {
				type: 'Identifier',
				name: '',
				start: expression.start,
				end: previous - 4
			} as AST.Expression;
		} else {
			parser.eat('}', true);
		}
	}

	const block = parser.append<AST.EachBlock>({
		type: 'EachBlock',
		start,
		end: -1,
		expression,
		body: fragment(),
		context,
		index,
		key
	});
	parser.push(block, block.body);
}

function stripAssertion(node: Node, end: number, found: (node: Node) => void): Node {
	if (node.type === 'TSAsExpression' && node.end === end) {
		found(node);
		return node.expression as Node;
	}
	for (const key in node) {
		if (key === 'type') continue;
		const child = node[key];
		if (child === null || typeof child !== 'object') continue;
		if (Array.isArray(child)) {
			for (let index = 0; index < child.length; index++) {
				const item = child[index] as Node | null;
				if (item !== null && typeof item === 'object' && item.type) {
					child[index] = stripAssertion(item, end, found);
				}
			}
		} else if ((child as Node).type) {
			node[key] = stripAssertion(child as Node, end, found);
		}
	}
	return node;
}

function awaitBlock(parser: Parser, start: number): void {
	parser.requireWhitespace();
	const expression = readExpression(parser);
	parser.allowWhitespace();
	const block = parser.append<AST.AwaitBlock>({
		type: 'AwaitBlock',
		start,
		end: -1,
		expression,
		value: null,
		error: null,
		pending: null,
		then: null,
		catch: null
	});

	if (parser.eat('then')) {
		if (parser.matchRegex(closingBrace)) parser.allowWhitespace();
		else {
			parser.requireWhitespace();
			block.value = readPattern(parser);
			parser.allowWhitespace();
		}
		block.then = fragment();
		parser.fragments.push(block.then);
	} else if (parser.eat('catch')) {
		if (parser.matchRegex(closingBrace)) parser.allowWhitespace();
		else {
			parser.requireWhitespace();
			block.error = readPattern(parser);
			parser.allowWhitespace();
		}
		block.catch = fragment();
		parser.fragments.push(block.catch);
	} else {
		block.pending = fragment();
		parser.fragments.push(block.pending);
	}

	if (!parser.eat('}', true, false)) {
		if (parser.template.slice(parser.index - 6, parser.index) === ' then ') {
			const previous = parser.index;
			block.value = readPattern(parser);
			parser.eat('}', true);
			block.expression = {
				type: 'Identifier',
				name: '',
				start: expression.start,
				end: previous - 6
			} as AST.Expression;
			block.then = block.pending;
			block.pending = null;
		} else if (parser.template.slice(parser.index - 7, parser.index) === ' catch ') {
			const previous = parser.index;
			block.error = readPattern(parser);
			parser.eat('}', true);
			block.expression = {
				type: 'Identifier',
				name: '',
				start: expression.start,
				end: previous - 7
			} as AST.Expression;
			block.catch = block.pending;
			block.pending = null;
		} else {
			parser.eat('}', true);
		}
	}
	parser.stack.push(block);
}

function snippet(parser: Parser, start: number): void {
	parser.requireWhitespace();
	const id = parser.readIdentifier();
	if (id.name === '' && !parser.loose) fail('expected_identifier', parser.index);
	parser.allowWhitespace();
	const paramsStart = parser.index;
	let typeParams: string | undefined;
	if (parser.ts && parser.match('<')) {
		const from = parser.index;
		const to = matchBracket(parser.template, from, pointy);
		typeParams = parser.template.slice(from + 1, to - 1);
		parser.index = to;
	}
	parser.allowWhitespace();
	const matched = parser.eat('(', true, false);
	if (matched) {
		let depth = 1;
		while (parser.index < parser.template.length && (!parser.match(')') || depth !== 1)) {
			if (parser.match('(')) depth++;
			if (parser.match(')')) depth--;
			parser.index += 1;
		}
		parser.eat(')', true);
	}
	const parameters = matched
		? (parseExpressionAt(parser, `${parser.template.slice(0, parser.index)} => {}`, paramsStart)
				.params as AST.Pattern[])
		: [];
	parser.allowWhitespace();
	parser.eat('}', true);
	const block = parser.append<AST.SnippetBlock>({
		type: 'SnippetBlock',
		start,
		end: -1,
		expression: id,
		typeParams,
		parameters,
		body: fragment()
	});
	parser.push(block, block.body);
}

function next(parser: Parser): void {
	const start = parser.index - 1;
	const block = parser.current();

	if (block.type === 'IfBlock') {
		if (!parser.eat('else')) fail('expected_token', start, { token: '{:else} or {:else if}' });
		if (parser.eat('if')) fail('block_invalid_elseif', start);
		if (block.alternate) fail('block_duplicate_clause', start, { name: '{:else}' });
		parser.allowWhitespace();
		parser.fragments.pop();
		block.alternate = fragment();
		parser.fragments.push(block.alternate);
		if (parser.eat('if')) {
			parser.requireWhitespace();
			const test = readExpression(parser);
			parser.allowWhitespace();
			parser.eat('}', true);
			const child = parser.append<AST.IfBlock>({
				start: blockStart(parser, start - 1),
				end: -1,
				type: 'IfBlock',
				elseif: true,
				test,
				consequent: fragment(),
				alternate: null
			});
			parser.stack.push(child);
			parser.fragments.pop();
			parser.fragments.push(child.consequent);
		} else {
			parser.allowWhitespace();
			parser.eat('}', true);
		}
		return;
	}

	if (block.type === 'EachBlock') {
		if (!parser.eat('else')) fail('expected_token', start, { token: '{:else}' });
		if (block.fallback) fail('block_duplicate_clause', start, { name: '{:else}' });
		parser.allowWhitespace();
		parser.eat('}', true);
		block.fallback = fragment();
		parser.fragments.pop();
		parser.fragments.push(block.fallback);
		return;
	}

	if (block.type === 'AwaitBlock') {
		if (parser.eat('then')) {
			if (block.then) fail('block_duplicate_clause', start, { name: '{:then}' });
			if (!parser.eat('}')) {
				parser.requireWhitespace();
				block.value = readPattern(parser);
				parser.allowWhitespace();
				parser.eat('}', true);
			}
			block.then = fragment();
			parser.fragments.pop();
			parser.fragments.push(block.then);
			return;
		}
		if (parser.eat('catch')) {
			if (block.catch) fail('block_duplicate_clause', start, { name: '{:catch}' });
			if (!parser.eat('}')) {
				parser.requireWhitespace();
				block.error = readPattern(parser);
				parser.allowWhitespace();
				parser.eat('}', true);
			}
			block.catch = fragment();
			parser.fragments.pop();
			parser.fragments.push(block.catch);
			return;
		}
		fail('expected_token', start, { token: '{:then ...} or {:catch ...}' });
	}

	fail('block_invalid_continuation_placement', start);
}

const closers: Readonly<Record<string, string>> = {
	EachBlock: 'each',
	KeyBlock: 'key',
	AwaitBlock: 'await',
	SnippetBlock: 'snippet'
};

function close(parser: Parser): void {
	const start = parser.index - 1;
	let block = parser.current();

	if (block.type === 'IfBlock') {
		if (!parser.eat('if', true, false)) {
			block.end = start - 1;
			parser.pop();
			close(parser);
			return;
		}
		parser.allowWhitespace();
		parser.eat('}', true);
		while ((block as AST.IfBlock).elseif) {
			block.end = parser.index;
			parser.stack.pop();
			block = parser.current();
		}
		block.end = parser.index;
		parser.pop();
		return;
	}

	let matched: boolean;
	const word = closers[block.type];
	if (word !== undefined) {
		matched = parser.eat(word, true, false);
	} else if (block.type === 'RegularElement' && parser.loose) {
		matched = false;
	} else {
		fail('block_unexpected_close', start);
	}

	if (!matched) {
		block.end = start - 1;
		parser.pop();
		close(parser);
		return;
	}
	parser.allowWhitespace();
	parser.eat('}', true);
	block.end = parser.index;
	parser.pop();
}

function special(parser: Parser): void {
	const start = blockStart(parser, parser.index);

	if (parser.eat('html')) {
		parser.requireWhitespace();
		const expression = readExpression(parser);
		parser.allowWhitespace();
		parser.eat('}', true);
		parser.append({ type: 'HtmlTag', start, end: parser.index, expression });
		return;
	}

	if (parser.eat('debug')) {
		let identifiers: (ES.Identifier & AST.Located)[];
		if (parser.read(closingBrace)) {
			identifiers = [];
		} else {
			const expression = readExpression(parser);
			identifiers = (
				expression.type === 'SequenceExpression' ? expression.expressions : [expression]
			) as (ES.Identifier & AST.Located)[];
			for (const node of identifiers) {
				if (node.type !== 'Identifier') fail('debug_tag_invalid_arguments', node.start);
			}
			parser.allowWhitespace();
			parser.eat('}', true);
		}
		parser.append({ type: 'DebugTag', start, end: parser.index, identifiers });
		return;
	}

	if (parser.eat('const')) {
		parser.requireWhitespace();
		const id = readPattern(parser);
		parser.allowWhitespace();
		parser.eat('=', true);
		parser.allowWhitespace();
		const expressionStart = parser.index;
		const init = readExpression(parser);
		const declaratorEnd = parser.index;
		if (
			init.type === 'SequenceExpression' &&
			!parser.template.substring(expressionStart, init.start as number).includes('(')
		) {
			fail('const_tag_invalid_expression', init);
		}
		parser.allowWhitespace();
		parser.eat('}', true);
		parser.append({
			type: 'ConstTag',
			start,
			end: parser.index,
			declaration: {
				type: 'VariableDeclaration',
				kind: 'const',
				declarations: [
					{ type: 'VariableDeclarator', id, init, start: id.start as number, end: declaratorEnd }
				],
				start: start + 2,
				end: parser.index - 1
			}
		});
		return;
	}

	if (parser.eat('render')) {
		parser.requireWhitespace();
		const expression = readExpression(parser);
		if (
			expression.type !== 'CallExpression' &&
			(expression.type !== 'ChainExpression' || expression.expression.type !== 'CallExpression')
		) {
			fail('render_tag_invalid_expression', expression);
		}
		parser.allowWhitespace();
		parser.eat('}', true);
		parser.append({
			type: 'RenderTag',
			start,
			end: parser.index,
			expression: expression as AST.RenderTag['expression']
		});
		return;
	}

	fail('expected_tag', parser.index);
}
