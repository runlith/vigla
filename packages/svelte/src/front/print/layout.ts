import type { Context } from 'esrap';
import type * as AST from '../ast.ts';

export const lineBreak = 50;

export interface State {
	preserve: number;
}

export function block(
	context: Context,
	node: { type: string },
	preserve = false,
	inline = false
): void {
	if (preserve) {
		context.visit(node);
		return;
	}
	const child = context.new();
	child.visit(node);
	if (child.empty()) return;
	if (inline && !child.multiline) {
		context.append(child);
		return;
	}
	context.indent();
	context.newline();
	context.append(child);
	context.dedent();
	context.newline();
}

export function attributes(
	node: AST.Located,
	list: readonly AST.AttributeLike[],
	context: Context,
	comments: readonly AST.JSComment[]
): boolean {
	if (list.length === 0) return false;
	let length = -1;
	let index = comments.findIndex((comment) => comment.start > node.start);
	if (index === -1) index = comments.length;
	const separator = context.new();
	let previousEnd = node.start;

	const children = list.map((attribute) => {
		const child = context.new();
		while (index < comments.length) {
			const comment = comments[index] as AST.JSComment;
			if (comment.start >= attribute.start) break;
			if (comment.start >= previousEnd) {
				if (comment.type === 'Line') {
					child.write(`//${comment.value}`);
					child.newline();
				} else {
					child.write(`/*${comment.value}*/`);
					child.append(separator);
				}
			}
			index += 1;
		}
		child.visit(attribute);
		previousEnd = attribute.end;
		length += child.measure() + 1;
		return child;
	});

	const multiline = context.multiline || length > lineBreak;
	if (multiline) {
		separator.newline();
		context.indent();
		for (const child of children) {
			context.newline();
			context.append(child);
		}
		context.dedent();
		context.newline();
	} else {
		separator.write(' ');
		for (const child of children) {
			context.write(' ');
			context.append(child);
		}
	}
	return multiline;
}
