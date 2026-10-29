import type { Context, Visitors } from 'esrap';
import type * as AST from '../ast.ts';
import { attributes } from './layout.ts';

type Item = AST.Css.Rule | AST.Css.Atrule | AST.Css.Declaration;

const identifierChar = /^[a-zA-Z0-9_-]$/;
const hexDigit = /[0-9a-fA-F]/;

function isDigit(char: string): boolean {
	return char >= '0' && char <= '9';
}

export function escapeIdentifier(name: string): string {
	let escaped = '';
	let index = 0;
	while (index < name.length) {
		const char = name[index] as string;
		if (char === '\\') {
			const next = name.charAt(index + 1);
			if (next === '' || hexDigit.test(next)) {
				escaped += '\\5c ';
				index += 1;
				continue;
			}
			escaped += `\\${next}`;
			index += 2;
			continue;
		}
		const code = char.codePointAt(0) as number;
		const leadingDigit = index === 0 && isDigit(char);
		const leadingHyphenDigit = index === 0 && char === '-' && isDigit(name.charAt(index + 1));
		if (leadingDigit || leadingHyphenDigit || !(identifierChar.test(char) || code >= 160)) {
			escaped += `\\${code.toString(16)} `;
		} else {
			escaped += char;
		}
		index += 1;
	}
	return escaped;
}

export function cssVisitors(
	comments: readonly AST.Css.Comment[],
	scriptComments: readonly AST.JSComment[]
): Visitors {
	let next = 0;
	const before = (end: number): boolean => {
		const comment = comments[next];
		return comment !== undefined && comment.start < end;
	};
	const writeComment = (context: Context, comment: AST.Css.Comment): void => {
		context.write(`/*${comment.value}*/`);
	};
	const inline = (context: Context, end: number): boolean => {
		let written = false;
		while (before(end)) {
			if (written) context.write(' ');
			writeComment(context, comments[next++] as AST.Css.Comment);
			written = true;
		}
		return written;
	};
	const value = (context: Context, text: string, end: number): void => {
		let offset = 0;
		while (before(end)) {
			const comment = comments[next++] as AST.Css.Comment;
			const position = Math.max(offset, Math.min(comment.position ?? 0, text.length));
			context.write(text.slice(offset, position));
			writeComment(context, comment);
			offset = position;
		}
		context.write(text.slice(offset));
	};
	const children = (
		context: Context,
		items: readonly Item[],
		end: number,
		margins: boolean
	): void => {
		let started = false;
		const separate = (): void => {
			if (!started) return;
			if (margins) context.margin();
			context.newline();
		};
		for (const child of items) {
			while (before(child.start)) {
				separate();
				writeComment(context, comments[next++] as AST.Css.Comment);
				started = true;
			}
			separate();
			context.visit(child);
			started = true;
		}
		while (before(end)) {
			separate();
			writeComment(context, comments[next++] as AST.Css.Comment);
			started = true;
		}
	};
	const selectors = (node: AST.Css.SelectorList, context: Context, multiline: boolean): void => {
		let separated = false;
		let remaining = node.children.length;
		for (const selector of node.children) {
			while (before(selector.start)) {
				if (separated) context.write(' ');
				writeComment(context, comments[next++] as AST.Css.Comment);
				separated = true;
			}
			if (separated) {
				if (multiline) context.newline();
				else context.write(' ');
			}
			context.visit(selector);
			separated = true;
			remaining -= 1;
			if (remaining > 0) context.write(',');
		}
	};
	const args = (
		node: AST.Css.PseudoClassSelector | AST.Css.PseudoElementSelector,
		context: Context
	): void => {
		if (!node.args) return;
		context.write('(');
		context.visit(node.args);
		if (before(node.end)) {
			context.write(' ');
			inline(context, node.end);
		}
		context.write(')');
	};

	const visitors: Record<string, (node: never, context: Context) => void> = {
		Atrule(node: AST.Css.Atrule, context: Context) {
			context.write(`@${escapeIdentifier(node.name)}`);
			const preludeEnd = node.block?.start ?? node.end;
			if (node.prelude || before(preludeEnd)) {
				context.write(' ');
				value(context, node.prelude, preludeEnd);
			}
			if (node.block) {
				context.write(' ');
				context.visit(node.block);
			} else {
				context.write(';');
			}
		},
		AttributeSelector(node: AST.Css.AttributeSelector, context: Context) {
			context.write(`[${escapeIdentifier(node.name)}`);
			if (node.matcher) {
				context.write(node.matcher);
				context.write(`"${node.value}"`);
				if (node.flags) context.write(` ${node.flags}`);
			}
			context.write(']');
		},
		Block(node: AST.Css.Block, context: Context) {
			context.write('{');
			if (node.children.length > 0 || before(node.end)) {
				context.indent();
				context.newline();
				children(context, node.children, node.end, false);
				context.dedent();
				context.newline();
			}
			context.write('}');
		},
		ClassSelector(node: AST.Css.ClassSelector, context: Context) {
			context.write(`.${escapeIdentifier(node.name)}`);
		},
		ComplexSelector(node: AST.Css.ComplexSelector, context: Context) {
			for (const selector of node.children) context.visit(selector);
		},
		Declaration(node: AST.Css.Declaration, context: Context) {
			context.write(`${node.property}: `);
			value(context, node.value, node.end);
			context.write(';');
		},
		IdSelector(node: AST.Css.IdSelector, context: Context) {
			context.write(`#${escapeIdentifier(node.name)}`);
		},
		NestingSelector(_: AST.Css.NestingSelector, context: Context) {
			context.write('&');
		},
		Nth(node: AST.Css.Nth, context: Context) {
			context.write(node.value);
		},
		Percentage(node: AST.Css.Percentage, context: Context) {
			context.write(node.value);
		},
		PseudoClassSelector(node: AST.Css.PseudoClassSelector, context: Context) {
			context.write(`:${escapeIdentifier(node.name)}`);
			args(node, context);
		},
		PseudoElementSelector(node: AST.Css.PseudoElementSelector, context: Context) {
			context.write(`::${escapeIdentifier(node.name)}`);
			args(node, context);
		},
		RelativeSelector(node: AST.Css.RelativeSelector, context: Context) {
			if (node.combinator) {
				context.write(node.combinator.name === ' ' ? ' ' : ` ${node.combinator.name} `);
			}
			for (const selector of node.selectors) context.visit(selector);
		},
		Rule(node: AST.Css.Rule, context: Context) {
			selectors(node.prelude, context, true);
			context.write(' ');
			if (inline(context, node.block.start)) context.write(' ');
			context.visit(node.block);
		},
		SelectorList(node: AST.Css.SelectorList, context: Context) {
			selectors(node, context, false);
		},
		StyleSheet(node: AST.Css.StyleSheet, context: Context) {
			context.write('<style');
			attributes(node, node.attributes, context, scriptComments);
			context.write('>');
			if (node.children.length > 0 || node.comments.length > 0) {
				context.indent();
				context.newline();
				children(context, node.children, node.content.end, true);
				context.dedent();
				context.newline();
			}
			context.write('</style>');
		},
		TypeSelector(node: AST.Css.TypeSelector, context: Context) {
			if (node.namespace !== undefined) {
				context.write(node.namespace === '*' ? '*' : escapeIdentifier(node.namespace));
				context.write('|');
			}
			context.write(node.name === '*' ? node.name : escapeIdentifier(node.name));
		}
	};
	return visitors as unknown as Visitors;
}
