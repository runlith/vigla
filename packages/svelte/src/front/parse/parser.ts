import type * as ES from 'estree';
import type { Diagnostic } from 'vigla/compiler';
import type * as AST from '../ast.ts';
import { fail, warning, type Args, type At } from '../diagnostics.ts';
import type { Locator } from '../locate.ts';
import { isReserved, isWhitespace } from './html.ts';
import { identifierEnd } from './identifier.ts';
import type { Context } from './js.ts';

export type Open = AST.Root | AST.ElementLike | AST.Block;

export interface AutoClosed {
	readonly tag: string;
	readonly reason: string;
	readonly depth: number;
}

export type Identifier = ES.Identifier & AST.Located & { loc: AST.NameLocation };

const scriptLang =
	/<!--[^]*?-->|<script\s+(?:[^>]*|(?:[^=>'"/]+=(?:"[^"]*"|'[^']*'|[^>\s]+)\s+)*)lang=(["'])?([^"' >]+)\1[^>]*>/g;

function typescript(source: string): boolean {
	scriptLang.lastIndex = 0;
	let match: RegExpExecArray | null;
	do match = scriptLang.exec(source);
	while (match !== null && match[0][1] !== 's');
	scriptLang.lastIndex = 0;
	return match?.[2] === 'ts';
}

export class Scanner {
	template: string;
	readonly loose: boolean;
	cssComments: AST.Css.Comment[] = [];
	index = 0;

	constructor(template: string, loose: boolean) {
		this.template = template;
		this.loose = loose;
	}

	match(text: string): boolean {
		return text.length === 1
			? this.template[this.index] === text
			: this.template.startsWith(text, this.index);
	}

	eat(text: string, required = false, requiredInLoose = true): boolean {
		if (this.match(text)) {
			this.index += text.length;
			return true;
		}
		if (required && (!this.loose || requiredInLoose))
			fail('expected_token', this.index, { token: text });
		return false;
	}

	matchRegex(pattern: RegExp): string | null {
		pattern.lastIndex = this.index;
		const match = pattern.exec(this.template);
		if (match === null || match.index !== this.index) return null;
		return match[0];
	}

	read(pattern: RegExp): string | null {
		const result = this.matchRegex(pattern);
		if (result) this.index += result.length;
		return result;
	}

	allowWhitespace(): void {
		while (
			this.index < this.template.length &&
			isWhitespace(this.template.charCodeAt(this.index))
		) {
			this.index++;
		}
	}

	readUntil(delimiter: string): string {
		if (this.index >= this.template.length) {
			if (this.loose) return '';
			fail('unexpected_eof', this.template.length);
		}
		const start = this.index;
		const found = this.template.indexOf(delimiter, start);
		this.index = found === -1 ? this.template.length : found;
		return this.template.slice(start, this.index);
	}

	readUntilRegex(pattern: RegExp): string {
		if (this.index >= this.template.length) {
			if (this.loose) return '';
			fail('unexpected_eof', this.template.length);
		}
		const start = this.index;
		const match = pattern.exec(this.template.slice(start));
		this.index = match === null ? this.template.length : start + match.index;
		return this.template.slice(start, this.index);
	}
}

export class Parser extends Scanner implements Context {
	readonly ts: boolean;
	readonly locate: Locator;
	readonly root: AST.Root;
	readonly stack: Open[] = [];
	readonly fragments: AST.Fragment[] = [];
	readonly meta = new Set<string>();
	readonly warnings: Diagnostic[] = [];
	lastAutoClosed: AutoClosed | undefined;

	constructor(source: string, loose: boolean, locate: Locator) {
		super(source.trimEnd(), loose);
		this.locate = locate;
		this.ts = typescript(source);
		this.root = {
			css: null,
			js: [],
			start: 0,
			end: source.length,
			type: 'Root',
			fragment: { type: 'Fragment', nodes: [] },
			options: null,
			comments: []
		};
		this.stack.push(this.root);
		this.fragments.push(this.root.fragment);
	}

	get comments(): AST.JSComment[] {
		return this.root.comments;
	}

	current(): Open {
		return this.stack[this.stack.length - 1] as Open;
	}

	warn(code: string, at: At, args?: Args): void {
		this.warnings.push(warning(code, at, args));
	}

	requireWhitespace(): void {
		if (!isWhitespace(this.template.charCodeAt(this.index)))
			fail('expected_whitespace', this.index);
		this.index++;
		this.allowWhitespace();
	}

	readIdentifier(): Identifier {
		const start = this.index;
		let end = identifierEnd(this.template, start);
		let name = '';
		if (end === -1) {
			end = start;
		} else {
			name = this.template.slice(start, end);
			this.index = end;
			if (isReserved(name)) fail('unexpected_reserved_word', start, { word: name });
		}
		return {
			type: 'Identifier',
			name,
			start,
			end,
			loc: { start: this.locate(start), end: this.locate(end) }
		};
	}

	push(node: Open, fragment: AST.Fragment): void {
		this.stack.push(node);
		this.fragments.push(fragment);
	}

	pop(): Open | undefined {
		this.fragments.pop();
		return this.stack.pop();
	}

	append<T extends AST.TemplateNode>(node: T): T {
		this.fragments.at(-1)?.nodes.push(node);
		return node;
	}
}

export function fragment(): AST.Fragment {
	return { type: 'Fragment', nodes: [] };
}
