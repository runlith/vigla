import type { Diagnostic } from 'vigla/compiler';
import type * as AST from '../ast.ts';
import { fail } from '../diagnostics.ts';
import { locator, type Locator } from '../locate.ts';
import { element } from './element.ts';
import { readOptions } from './options.ts';
import { Parser, Scanner } from './parser.ts';
import { readStylesheet } from './style.ts';
import { tag } from './tag.ts';
import { decode } from './decode.ts';

export interface Parsed {
	readonly root: AST.Root;
	readonly ts: boolean;
	readonly options: AST.ElementLike | null;
	readonly warnings: readonly Diagnostic[];
	readonly locate: Locator;
}

function text(parser: Parser): void {
	const start = parser.index;
	const template = parser.template;
	let index = start;
	while (index < template.length) {
		const char = template[index];
		if (char === '<' || char === '{') break;
		index++;
	}
	parser.index = index;
	const data = template.slice(start, index);
	parser.append({ type: 'Text', start, end: index, raw: data, data: decode(data, false) });
}

export function parseComponent(source: string, loose = false): Parsed {
	const locate = locator(source);
	const parser = new Parser(source, loose, locate);
	while (parser.index < parser.template.length) {
		if (parser.match('<')) element(parser);
		else if (parser.match('{')) tag(parser);
		else text(parser);
	}

	if (parser.stack.length > 1) {
		const current = parser.current() as AST.ElementLike | AST.Block;
		if (parser.loose) {
			current.end = parser.template.length;
		} else {
			current.end = current.start + 1;
			if (current.type === 'RegularElement')
				fail('element_unclosed', current, { name: current.name });
			fail('block_unclosed', current);
		}
	}

	const root = parser.root;
	const nodes = root.fragment.nodes;
	const at = nodes.findIndex((node) => node.type === 'SvelteOptions');
	let options: AST.ElementLike | null = null;
	if (at !== -1) {
		options = nodes.splice(at, 1)[0] as AST.ElementLike;
		root.options = readOptions(options);
		const children = options.fragment.nodes;
		if (children.length > 0) {
			fail(
				'svelte_meta_invalid_content',
				{
					start: (children[0] as AST.TemplateNode).start,
					end: (children.at(-1) as AST.TemplateNode).end
				},
				{ name: options.name }
			);
		}
	}

	return { root, ts: parser.ts, options, warnings: parser.warnings, locate };
}

export function parseStylesheet(source: string): AST.Css.StyleSheetFile {
	const scanner = new Scanner(source, false);
	const children = readStylesheet(scanner);
	return {
		type: 'StyleSheetFile',
		start: 0,
		end: source.length,
		children,
		comments: scanner.cssComments
	};
}
