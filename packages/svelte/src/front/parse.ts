import type * as ES from 'estree';
import { CompileError, parseExpression, parseProgram } from 'dromon/compiler';
import type {
	Attribute,
	Comment,
	EachBlock,
	ExpressionTag,
	Fragment,
	IfBlock,
	RegularElement,
	Root,
	Script,
	TemplateNode,
	Text
} from './ast.ts';

const named: Readonly<Record<string, string>> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' '
};

const entity = /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi;

function decode(raw: string): string {
	return raw.replace(entity, (whole, body: string) => {
		if (body.startsWith('#x') || body.startsWith('#X'))
			return String.fromCodePoint(parseInt(body.slice(2), 16));
		if (body.startsWith('#')) return String.fromCodePoint(parseInt(body.slice(1), 10));
		return named[body.toLowerCase()] ?? whole;
	});
}

const voids = new Set([
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'param',
	'source',
	'track',
	'wbr'
]);

const nameChar = /[A-Za-z0-9_:.-]/;
const attributeEnd = /[\s=/>"'{]/;

class Parser {
	readonly source: string;
	index = 0;
	instance: Script | null = null;
	module: Script | null = null;

	constructor(source: string) {
		this.source = source;
	}

	fail(code: string, message: string, start = this.index, end = start): never {
		throw new CompileError({ code, message, start, end });
	}

	unsupported(what: string, start = this.index): never {
		this.fail('unsupported', `${what} is not supported yet`, start);
	}

	at(text: string): boolean {
		return this.source.startsWith(text, this.index);
	}

	eat(text: string): boolean {
		if (!this.at(text)) return false;
		this.index += text.length;
		return true;
	}

	expect(text: string): void {
		if (!this.eat(text)) {
			if (this.index >= this.source.length) this.fail('unexpected_eof', 'Unexpected end of input');
			this.fail('expected_token', `Expected token ${text}`);
		}
	}

	space(): void {
		while (this.index < this.source.length && /\s/.test(this.source[this.index] ?? ''))
			this.index++;
	}

	word(): string {
		const start = this.index;
		while (this.index < this.source.length && nameChar.test(this.source[this.index] ?? ''))
			this.index++;
		return this.source.slice(start, this.index);
	}

	expression(): ES.Expression {
		const expression = parseExpression(this.source, this.index);
		this.index = expression.end;
		return expression;
	}

	root(): Root {
		const nodes = this.nodes(true);
		if (this.index < this.source.length) {
			if (this.at('</')) this.fail('element_invalid_closing_tag', 'Unexpected closing tag');
			this.fail('block_unexpected_close', 'Unexpected block closing tag');
		}
		return {
			type: 'Root',
			start: 0,
			end: this.source.length,
			fragment: { type: 'Fragment', nodes },
			instance: this.instance,
			module: this.module
		};
	}

	nodes(top: boolean): TemplateNode[] {
		const nodes: TemplateNode[] = [];
		while (this.index < this.source.length) {
			if (this.at('<!--')) {
				nodes.push(this.comment());
			} else if (this.at('</')) {
				break;
			} else if (this.at('<')) {
				const element = this.element(top);
				if (element !== null) nodes.push(element);
			} else if (this.at('{')) {
				const start = this.index;
				this.index++;
				this.space();
				if (this.at(':') || this.at('/')) {
					this.index = start;
					break;
				}
				if (this.eat('#if')) nodes.push(this.ifBlock(start));
				else if (this.eat('#each')) nodes.push(this.eachBlock(start));
				else if (this.at('#') || this.at('@')) {
					const tag = /^[#@]\w*/.exec(this.source.slice(this.index))?.[0] ?? '';
					this.unsupported(`The {${tag}} tag`, start);
				} else nodes.push(this.expressionTag(start));
			} else {
				nodes.push(this.text());
			}
		}
		return nodes;
	}

	text(): Text {
		const start = this.index;
		while (this.index < this.source.length && !this.at('<') && !this.at('{')) this.index++;
		const raw = this.source.slice(start, this.index);
		return { type: 'Text', start, end: this.index, raw, data: decode(raw) };
	}

	comment(): Comment {
		const start = this.index;
		this.index += 4;
		const end = this.source.indexOf('-->', this.index);
		if (end === -1) this.fail('unexpected_eof', 'Unexpected end of input');
		const data = this.source.slice(this.index, end);
		this.index = end + 3;
		return { type: 'Comment', start, end: this.index, data };
	}

	expressionTag(start: number): ExpressionTag {
		const expression = this.expression();
		this.space();
		this.expect('}');
		return { type: 'ExpressionTag', start, end: this.index, expression };
	}

	closing(name: string): void {
		this.space();
		this.expect(name);
		this.space();
		this.expect('}');
	}

	branchRest(): Fragment | null {
		const start = this.index;
		if (!this.eat('{')) return null;
		this.space();
		if (!this.eat(':else')) {
			this.index = start;
			return null;
		}
		this.space();
		if (this.eat('if')) {
			this.space();
			const test = this.expression();
			this.space();
			this.expect('}');
			const consequent: Fragment = { type: 'Fragment', nodes: this.nodes(false) };
			const alternate = this.branchRest();
			const inner: IfBlock = {
				type: 'IfBlock',
				elseif: true,
				start,
				end: this.index,
				test,
				consequent,
				alternate
			};
			return { type: 'Fragment', nodes: [inner] };
		}
		this.expect('}');
		return { type: 'Fragment', nodes: this.nodes(false) };
	}

	ifBlock(start: number): IfBlock {
		this.space();
		const test = this.expression();
		this.space();
		this.expect('}');
		const consequent: Fragment = { type: 'Fragment', nodes: this.nodes(false) };
		const alternate = this.branchRest();
		if (!this.eat('{')) this.fail('block_unclosed', 'Block was left open', start);
		this.space();
		this.expect('/');
		this.closing('if');
		return { type: 'IfBlock', elseif: false, start, end: this.index, test, consequent, alternate };
	}

	eachBlock(start: number): EachBlock {
		this.space();
		const expression = this.expression();
		this.space();
		let context: ES.Pattern | null = null;
		if (this.eat('as')) {
			this.space();
			const from = this.index;
			while (/[\w$]/.test(this.source[this.index] ?? '')) this.index++;
			const name = this.source.slice(from, this.index);
			if (!/^[A-Za-z_$][\w$]*$/.test(name)) this.unsupported('An each block item pattern', from);
			context = { type: 'Identifier', name, start: from, end: this.index } as ES.Identifier;
			this.space();
		}
		if (this.at(',')) this.unsupported('An each block index');
		let key: ES.Expression | undefined;
		if (this.eat('(')) {
			this.space();
			key = this.expression();
			this.space();
			this.expect(')');
			this.space();
		}
		this.expect('}');
		const body: Fragment = { type: 'Fragment', nodes: this.nodes(false) };
		if (!this.eat('{')) this.fail('block_unclosed', 'Block was left open', start);
		this.space();
		if (this.at(':')) this.unsupported('An each block fallback');
		this.expect('/');
		this.closing('each');
		const block: EachBlock = {
			type: 'EachBlock',
			start,
			end: this.index,
			expression,
			context,
			body
		};
		if (key !== undefined) block.key = key;
		return block;
	}

	attributeValue(): (Text | ExpressionTag)[] | ExpressionTag {
		if (this.at('{')) {
			const start = this.index;
			this.index++;
			this.space();
			return this.expressionTag(start);
		}
		const quote = this.at('"') ? '"' : this.at("'") ? "'" : null;
		if (quote !== null) this.index++;
		const parts: (Text | ExpressionTag)[] = [];
		let start = this.index;
		const done = (): boolean =>
			quote === null
				? /[\s>]/.test(this.source[this.index] ?? '>') || this.at('/>')
				: this.at(quote);
		while (this.index < this.source.length && !done()) {
			if (this.at('{')) {
				if (this.index > start) parts.push(this.textPart(start));
				const tag = this.index;
				this.index++;
				this.space();
				parts.push(this.expressionTag(tag));
				start = this.index;
			} else {
				this.index++;
			}
		}
		if (this.index > start || parts.length === 0) parts.push(this.textPart(start));
		if (quote !== null) this.expect(quote);
		return parts;
	}

	textPart(start: number): Text {
		const raw = this.source.slice(start, this.index);
		return { type: 'Text', start, end: this.index, raw, data: decode(raw) };
	}

	attributes(): Attribute[] {
		const attributes: Attribute[] = [];
		for (;;) {
			this.space();
			if (this.at('>') || this.at('/>')) return attributes;
			if (this.index >= this.source.length) this.fail('unexpected_eof', 'Unexpected end of input');
			const start = this.index;
			if (this.at('{')) this.unsupported('A spread or shorthand attribute');
			while (this.index < this.source.length && !attributeEnd.test(this.source[this.index] ?? ''))
				this.index++;
			const name = this.source.slice(start, this.index);
			if (name === '') this.fail('expected_attribute_value', 'Expected attribute');
			if (name.includes(':')) this.unsupported(`The ${name.split(':')[0] ?? ''} directive`, start);
			this.space();
			const value = this.eat('=') ? (this.space(), this.attributeValue()) : true;
			attributes.push({ type: 'Attribute', start, end: this.index, name, value });
		}
	}

	script(start: number, attributes: Attribute[]): void {
		this.expect('>');
		const contentStart = this.index;
		const end = this.source.indexOf('</script', contentStart);
		if (end === -1) this.fail('element_unclosed', '`<script>` was left open', start);
		const lang = attributes.find((attribute) => attribute.name === 'lang');
		if (lang !== undefined) this.unsupported('A script lang attribute', lang.start);
		const module = attributes.some(
			(attribute) =>
				attribute.name === 'module' ||
				(attribute.name === 'context' &&
					Array.isArray(attribute.value) &&
					attribute.value[0]?.type === 'Text' &&
					attribute.value[0].data === 'module')
		);
		const content = parseProgram(this.source, contentStart, end);
		this.index = end + '</script'.length;
		this.space();
		this.expect('>');
		const script: Script = {
			type: 'Script',
			start,
			end: this.index,
			context: module ? 'module' : 'default',
			content,
			attributes
		};
		if (module) {
			if (this.module !== null)
				this.fail(
					'script_duplicate',
					'A component can have a single top-level `<script module>` element',
					start
				);
			this.module = script;
		} else {
			if (this.instance !== null)
				this.fail(
					'script_duplicate',
					'A component can have a single top-level `<script>` element',
					start
				);
			this.instance = script;
		}
	}

	element(top: boolean): RegularElement | null {
		const start = this.index;
		this.index++;
		const name = this.word();
		if (name === '')
			this.fail('tag_invalid_name', 'Expected a valid element or component name', start);
		const attributes = this.attributes();
		if (top && name === 'script') {
			this.script(start, attributes);
			return null;
		}
		if (name === 'style') this.unsupported('A style element', start);
		if (name.includes(':') || /^[A-Z]/.test(name) || name.includes('.'))
			this.unsupported(`The <${name}> element`, start);
		let nodes: TemplateNode[] = [];
		if (this.eat('/>') || (this.eat('>') && voids.has(name.toLowerCase()))) {
			return {
				type: 'RegularElement',
				start,
				end: this.index,
				name,
				attributes,
				fragment: { type: 'Fragment', nodes }
			};
		}
		nodes = this.nodes(false);
		if (!this.eat('</')) this.fail('element_unclosed', `\`<${name}>\` was left open`, start);
		this.expect(name);
		this.space();
		this.expect('>');
		return {
			type: 'RegularElement',
			start,
			end: this.index,
			name,
			attributes,
			fragment: { type: 'Fragment', nodes }
		};
	}
}

export function parse(source: string): Root {
	return new Parser(source).root();
}
