import * as acorn from 'acorn';
import { tsPlugin } from '@sveltejs/acorn-typescript';
import type * as ES from 'estree';
import type { JSComment, Located } from '../ast.ts';
import { fail } from '../diagnostics.ts';
import type { Locator } from '../locate.ts';
import { nonLfLineBreak } from './characters.ts';

interface Internals {
	undefinedExports: Record<string, unknown>;
	parseStatement(context: null, topLevel: boolean, exports: object): unknown;
	nextToken(): void;
}

type Constructor = typeof acorn.Parser;

function scripted(base: Constructor): Constructor {
	return class extends (base as unknown as new (...args: never[]) => Internals) {
		override parseStatement(context: null, topLevel: boolean, exports: object): unknown {
			const statement = super.parseStatement(context, topLevel, exports);
			this.undefinedExports = {};
			return statement;
		}
	} as unknown as Constructor;
}

const plain = acorn.Parser;
const typed = plain.extend(tsPlugin());
const plainScript = scripted(plain);
const typedScript = scripted(typed);

export interface Node extends Located {
	type: string;
	leadingComments?: Attached[];
	trailingComments?: Attached[];
	[key: string]: unknown;
}

interface Attached {
	type: 'Line' | 'Block';
	value: string;
	start: number;
	end: number;
}

export interface Context {
	readonly template: string;
	readonly ts: boolean;
	readonly comments: JSComment[];
	readonly locate: Locator;
}

const nonLf = nonLfLineBreak;
let lastTemplate = '';
let lfOnly = true;

export function lfLineBreaksOnly(template: string): boolean {
	if (template !== lastTemplate) {
		lastTemplate = template;
		lfOnly = !nonLf.test(template);
	}
	return lfOnly;
}

const positionSuffix = / \(\d+:\d+\)$/;

function rethrow(error: unknown): never {
	if (!(error instanceof SyntaxError)) throw error;
	const position = (error as SyntaxError & { pos: number }).pos;
	fail('js_parse_error', position, { message: error.message.replace(positionSuffix, '') });
}

function leading(source: string, start: number): string {
	let lineStart = start;
	while (lineStart > 0 && source[lineStart - 1] !== '\n') lineStart -= 1;
	let end = lineStart;
	while (source[end] === ' ' || source[end] === '\t') end += 1;
	return source.slice(lineStart, end);
}

const trailingGap = /^[,) \t]*$/;

class Comments {
	readonly source: string;
	readonly into: JSComment[];
	readonly from: number;

	constructor(source: string, into: JSComment[], from = 0) {
		this.source = source;
		this.into = into;
		this.from = from;
	}

	readonly onComment = (
		block: boolean,
		text: string,
		start: number,
		end: number,
		startLoc?: acorn.Position,
		endLoc?: acorn.Position
	): void => {
		let value = text;
		if (block && value.includes('\n')) {
			const indentation = leading(this.source, start);
			value = value.replace(new RegExp(`^${indentation}`, 'gm'), '');
		}
		this.into.push({
			type: block ? 'Block' : 'Line',
			value,
			start,
			end,
			loc: {
				start: startLoc as acorn.Position,
				end: endLoc as acorn.Position
			}
		});
	};

	attach(ast: Node): void {
		if (this.into.length === 0) return;
		const queue: Attached[] = [];
		for (const comment of this.into) {
			if (comment.start >= this.from) {
				queue.push({
					type: comment.type,
					value: comment.value,
					start: comment.start,
					end: comment.end
				});
			}
		}
		let head = 0;
		const source = this.source;
		const path: Node[] = [];

		const visit = (node: Node): void => {
			while (head < queue.length && (queue[head] as Attached).start < node.start) {
				(node.leadingComments ??= []).push(queue[head++] as Attached);
			}
			path.push(node);
			for (const key in node) {
				if (key === 'type') continue;
				const child = node[key];
				if (child === null || typeof child !== 'object') continue;
				if (Array.isArray(child)) {
					for (const item of child) {
						if (item !== null && typeof item === 'object' && (item as Node).type)
							visit(item as Node);
					}
				} else if ((child as Node).type) {
					visit(child as Node);
				}
			}
			path.pop();
			const next = queue[head];
			if (next === undefined) return;
			const parent = path.at(-1) as (Node & Record<string, unknown>) | undefined;
			if (parent !== undefined && node.end === parent.end) return;
			const gap = source.slice(node.end, next.start);
			if (last(parent, node)) {
				while (head < queue.length) {
					const comment = queue[head] as Attached;
					if (parent !== undefined && comment.start >= parent.end) break;
					(node.trailingComments ??= []).push(comment);
					head++;
				}
			} else if (node.end <= next.start && trailingGap.test(gap)) {
				node.trailingComments = [next];
				head++;
			}
		};

		visit(ast);
		if (head < queue.length) {
			const rest = queue[head] as Attached;
			if (rest.start >= ast.end || ast.type === 'Program') {
				(ast.trailingComments ??= []).push(...queue.slice(head));
			}
		}
	}
}

function last(parent: Record<string, unknown> | undefined, node: Node): boolean {
	if (parent === undefined) return false;
	const list =
		parent.type === 'BlockStatement' || parent.type === 'Program'
			? parent.body
			: parent.type === 'ArrayExpression'
				? parent.elements
				: parent.type === 'ObjectExpression'
					? parent.properties
					: null;
	return Array.isArray(list) && list.indexOf(node) === list.length - 1;
}

function startLocation(context: Context, index: number): acorn.Position | undefined {
	if (!lfLineBreaksOnly(context.template)) return undefined;
	const { line, column } = context.locate(index);
	return { line, column, offset: index } as acorn.Position;
}

export function parseScript(source: string, comments: JSComment[], ts: boolean): Node {
	const parser = ts ? typedScript : plainScript;
	const handler = new Comments(source, comments);
	try {
		const ast = parser.parse(source, {
			onComment: handler.onComment,
			sourceType: 'module',
			ecmaVersion: 16,
			locations: true
		}) as unknown as Node;
		handler.attach(ast);
		return ast;
	} catch (error) {
		rethrow(error);
	}
}

export function parseExpressionAt(context: Context, source: string, index: number): Node {
	const parser = context.ts ? typed : plain;
	const handler = new Comments(source, context.comments, index);
	try {
		const ast = parser.parseExpressionAt(source, index, {
			onComment: handler.onComment,
			sourceType: 'module',
			ecmaVersion: 16,
			locations: true,
			preserveParens: true,
			startLocation: startLocation(context, index)
		} as acorn.Options) as unknown as Node;
		handler.attach(ast);
		return ast;
	} catch (error) {
		rethrow(error);
	}
}

export function parseStatementAt(context: Context, source: string, index: number): Node {
	const Parser = (context.ts ? typed : plain) as unknown as new (
		options: acorn.Options,
		input: string,
		start: number
	) => Internals;
	const handler = new Comments(source, context.comments, index);
	try {
		const parser = new Parser(
			{
				onComment: handler.onComment,
				sourceType: 'module',
				ecmaVersion: 16,
				locations: true,
				startLocation: startLocation(context, index)
			} as acorn.Options,
			source,
			index
		);
		parser.nextToken();
		const statement = parser.parseStatement(null, true, Object.create(null)) as Node;
		handler.attach(statement);
		return statement;
	} catch (error) {
		if ((error as { pos?: number }).pos === source.length) fail('unexpected_eof', source.length);
		rethrow(error);
	}
}

export function removeParens<T>(node: T): T {
	if (node === null || typeof node !== 'object') return node;
	let current = node as unknown as Node;
	while (current.type === 'ParenthesizedExpression') current = current.expression as Node;
	for (const key in current) {
		if (key === 'type') continue;
		const child = current[key];
		if (child === null || typeof child !== 'object') continue;
		if (Array.isArray(child)) {
			for (let index = 0; index < child.length; index++) {
				const item = child[index] as Node | null;
				if (item !== null && typeof item === 'object' && item.type)
					child[index] = removeParens(item);
			}
		} else if ((child as Node).type) {
			current[key] = removeParens(child);
		}
	}
	return current as unknown as T;
}
