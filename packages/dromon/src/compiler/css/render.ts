import MagicString, { type SourceMap } from 'magic-string';
import type * as S from '../ir/style.ts';
import { isKeyframes, withoutPrefix, type Marks } from './marks.ts';

type Node =
	| S.StyleSheet
	| S.Rule
	| S.Atrule
	| S.Block
	| S.Declaration
	| S.SelectorList
	| S.ComplexSelector
	| S.RelativeSelector
	| S.Combinator
	| S.SimpleSelector;

interface Specificity {
	bumped: boolean;
}

interface State {
	readonly specificity: Specificity;
}

export interface Rendering {
	readonly source: string;
	readonly hash: string;
	readonly minify: boolean;
	readonly dev: boolean;
	readonly keyframes: readonly string[];
	readonly filename: string | null;
	readonly outputFilename: string | null;
}

export interface Sheet {
	readonly code: string;
	readonly map: SourceMap;
}

const boundary = /^[\s,;}]$/;
const space = /\s/;

export class Renderer {
	readonly #code: MagicString;
	readonly #marks: Marks;
	readonly #options: Rendering;
	readonly #selector: string;
	readonly #path: Node[] = [];

	constructor(marks: Marks, options: Rendering) {
		this.#code = new MagicString(options.source);
		this.#marks = marks;
		this.#options = options;
		this.#selector = `.${options.hash}`;
	}

	render(sheet: S.StyleSheet): Sheet {
		this.#visit(sheet, { specificity: { bumped: false } });
		const code = this.#code;
		code.remove(0, sheet.content.start);
		code.remove(sheet.content.end, this.#options.source.length);
		if (this.#options.minify) this.#trimBefore(sheet.content.end);
		const filename = this.#options.filename ?? undefined;
		const map = code.generateMap({
			includeContent: true,
			source: filename,
			file: this.#options.outputFilename ?? filename
		});
		return { code: code.toString(), map };
	}

	#visit(node: Node, state: State): void {
		this.#code.addSourcemapLocation(node.start);
		this.#code.addSourcemapLocation(node.end);
		switch (node.type) {
			case 'StyleSheet':
				this.#children(node, node.children, state);
				return;
			case 'Block':
				this.#children(node, node.children, state);
				return;
			case 'Atrule':
				this.#atrule(node, state);
				return;
			case 'Declaration':
				this.#declaration(node);
				return;
			case 'Rule':
				this.#rule(node, state);
				return;
			case 'SelectorList':
				this.#selectorList(node, state);
				return;
			case 'ComplexSelector':
				this.#complex(node, state);
				return;
			case 'RelativeSelector':
				this.#within(node, () => {
					if (node.combinator !== null) this.#visit(node.combinator, state);
					for (const selector of node.selectors) this.#visit(selector, state);
				});
				return;
			case 'PseudoClassSelector':
				if (
					node.args !== null &&
					(node.name === 'is' ||
						node.name === 'where' ||
						node.name === 'has' ||
						node.name === 'not')
				) {
					const args = node.args;
					this.#within(node, () => this.#visit(args, state));
				}
				return;
			default:
				return;
		}
	}

	#within(node: Node, run: () => void): void {
		this.#path.push(node);
		run();
		this.#path.pop();
	}

	#children(node: Node, children: readonly Node[], state: State): void {
		this.#within(node, () => {
			for (const child of children) this.#visit(child, state);
		});
	}

	#inGlobalBlock(): boolean {
		return this.#path.some((node) => node.type === 'Rule' && this.#marks.rule(node).isGlobalBlock);
	}

	#trimBefore(end: number): void {
		const original = this.#code.original;
		let start = end;
		while (space.test(original[start - 1] ?? '')) start--;
		if (start < end) this.#code.remove(start, end);
	}

	#atrule(node: S.Atrule, state: State): void {
		if (isKeyframes(node)) {
			const original = this.#code.original;
			let start = node.start + node.name.length + 1;
			while (original[start] === ' ') start += 1;
			if (node.prelude.startsWith('-global-')) this.#code.remove(start, start + 8);
			else if (!this.#inGlobalBlock()) this.#code.prependRight(start, `${this.#options.hash}-`);
			return;
		}
		if (node.block !== null) {
			const block = node.block;
			this.#within(node, () => this.#visit(block, state));
		}
	}

	#declaration(node: S.Declaration): void {
		const original = this.#code.original;
		const property = withoutPrefix(node.property.toLowerCase());
		if (property === 'animation' || property === 'animation-name') {
			let index = node.start + node.property.length + 1;
			let name = '';
			while (index < original.length) {
				const character = original[index] as string;
				if (boundary.test(character)) {
					if (this.#options.keyframes.includes(name)) {
						this.#code.prependRight(index - name.length, `${this.#options.hash}-`);
					}
					if (character === ';' || character === '}') break;
					name = '';
				} else {
					name += character;
				}
				index++;
			}
		} else if (this.#options.minify) {
			this.#trimBefore(node.start);
			if (!node.property.startsWith('--')) {
				const start = node.start + node.property.length + 1;
				let end = start;
				while (space.test(original[end] ?? '')) end++;
				if (end > start) this.#code.remove(start, end);
			}
		}
	}

	#empty(rule: S.Rule, inGlobalBlock: boolean): boolean {
		if (this.#marks.rule(rule).isGlobalBlock) return rule.block.children.length === 0;
		for (const child of rule.block.children) {
			if (child.type === 'Declaration') return false;
			if (child.type === 'Rule') {
				if ((this.#marks.used(child) || inGlobalBlock) && !this.#empty(child, inGlobalBlock)) {
					return false;
				}
			}
			if (child.type === 'Atrule') {
				if (child.block === null || child.block.children.length > 0) return false;
			}
		}
		return true;
	}

	#comment(node: S.Rule, label: string): void {
		if (this.#options.minify) {
			this.#code.remove(node.start, node.end);
			return;
		}
		this.#code.prependRight(node.start, `/* (${label}) `);
		this.#code.appendLeft(node.end, '*/');
		this.#escapeCommentClose(node);
	}

	#rule(node: S.Rule, state: State): void {
		const code = this.#code;
		if (this.#options.minify) {
			this.#trimBefore(node.start);
			this.#trimBefore(node.block.end - 1);
		}
		const inGlobalBlock = this.#inGlobalBlock();
		if (!this.#options.dev && this.#empty(node, inGlobalBlock)) {
			this.#comment(node, 'empty');
			return;
		}
		if (!this.#marks.used(node) && !inGlobalBlock) {
			this.#comment(node, 'unused');
			return;
		}
		if (this.#marks.rule(node).isGlobalBlock) {
			const selector = node.prelude.children[0];
			if (
				node.prelude.children.length === 1 &&
				selector?.children.length === 1 &&
				selector.children[0]?.selectors.length === 1
			) {
				if (this.#options.minify) {
					code.remove(node.start, node.block.start + 1);
					code.remove(node.block.end - 1, node.end);
				} else {
					code.prependRight(node.start, '/* ');
					code.appendLeft(node.block.start + 1, '*/');
					code.prependRight(node.block.end - 1, '/*');
					code.appendLeft(node.block.end, '*/');
				}
				this.#within(node, () => this.#visit(node.block, state));
				return;
			}
		}
		this.#within(node, () => {
			this.#visit(node.prelude, state);
			this.#visit(node.block, state);
		});
	}

	#selectorList(node: S.SelectorList, state: State): void {
		const parent = this.#path.at(-1);
		const parentGlobalBlock = parent?.type === 'Rule' && this.#marks.rule(parent).isGlobalBlock;
		if (
			(!this.#inGlobalBlock() || (node.children.length > 1 && parentGlobalBlock)) &&
			!this.#path.some((n) => n.type === 'ComplexSelector' && !this.#marks.complex(n).used)
		) {
			this.#pruneList(node);
		}

		let specificity = state.specificity;
		if (parent?.type === 'Rule') {
			specificity = { bumped: false };
			for (
				let rule = this.#marks.rule(parent).parent;
				rule !== null;
				rule = this.#marks.rule(rule).parent
			) {
				if (this.#marks.rule(rule).hasLocalSelectors) {
					specificity = { bumped: true };
					break;
				}
			}
		}
		const inner: State = { ...state, specificity };
		this.#children(node, node.children, inner);
	}

	#pruneList(node: S.SelectorList): void {
		const code = this.#code;
		const original = code.original;
		const minify = this.#options.minify;
		const children = node.children;
		let pruning = false;
		let pruneStart = children[0]?.start ?? node.start;
		let last = pruneStart;
		let previousUsed = false;
		children.forEach((selector, i) => {
			const used = this.#marks.complex(selector).used;
			if (used === pruning) {
				if (pruning) {
					let comma = selector.start;
					while (original[comma] !== ',') comma--;
					if (minify) code.remove(pruneStart, previousUsed ? comma : comma + 1);
					else code.appendRight(previousUsed ? comma : comma + 1, '*/');
				} else if (i === 0) {
					if (minify) pruneStart = selector.start;
					else code.prependRight(selector.start, '/* (unused) ');
				} else if (minify) {
					pruneStart = last;
				} else {
					code.overwrite(last, selector.start, ' /* (unused) ');
				}
				pruning = !pruning;
			}
			if (!pruning && used) previousUsed = true;
			last = selector.end;
		});
		if (pruning) {
			if (minify) code.remove(pruneStart, last);
			else code.appendLeft(last, '*/');
		}
	}

	#complex(node: S.ComplexSelector, state: State): void {
		const code = this.#code;
		const before = state.specificity.bumped;
		for (const relative of node.children) {
			const facts = this.#marks.relative(relative);
			if (facts.isGlobal) {
				const global = relative.selectors[0] as S.PseudoClassSelector;
				this.#removeGlobal(global, relative.combinator);
				const rule = this.#marks.complex(node).rule;
				const parentRule = rule === null ? null : this.#marks.rule(rule).parent;
				if (parentRule !== null && global.args === null) {
					if (relative.combinator === null) code.prependRight(global.start, '&');
					if (
						parentRule.prelude.children.length > 1 &&
						node.children.length === node.children.indexOf(relative) - 1
					) {
						const next = parentRule.prelude.children.find((s) => s.start > global.end);
						if (next !== undefined && this.#marks.complex(next).used) {
							code.update(global.end, next.start, '');
						}
					}
				}
				continue;
			}
			for (const selector of relative.selectors) {
				if (selector.type === 'PseudoClassSelector' && selector.name === 'global') {
					this.#removeGlobal(selector, null);
				}
			}
			if (!facts.scoped) continue;
			if (relative.selectors.length === 1) {
				const only = relative.selectors[0];
				if (only?.type === 'PseudoClassSelector' && (only.name === 'is' || only.name === 'where')) {
					continue;
				}
			}
			if (relative.selectors.some((s) => s.type === 'NestingSelector')) continue;

			let modifier = this.#selector;
			if (state.specificity.bumped) modifier = `:where(${modifier})`;
			state.specificity.bumped = true;

			for (let i = relative.selectors.length - 1; i >= 0; i--) {
				const selector = relative.selectors[i] as S.SimpleSelector;
				if (selector.type === 'PseudoElementSelector' || selector.type === 'PseudoClassSelector') {
					if (selector.name !== 'root' && selector.name !== 'host' && i === 0) {
						code.prependRight(selector.start, modifier);
					}
					continue;
				}
				if (
					selector.type === 'TypeSelector' &&
					selector.name === '*' &&
					selector.namespace === undefined
				) {
					code.update(selector.start, selector.end, modifier);
				} else {
					code.appendLeft(selector.end, modifier);
				}
				break;
			}
		}
		this.#children(node, node.children, state);
		state.specificity.bumped = before;
	}

	#removeGlobal(selector: S.PseudoClassSelector, combinator: S.Combinator | null): void {
		const code = this.#code;
		if (selector.args === null) {
			let start = selector.start;
			if (combinator?.name === ' ') {
				while (space.test(code.original[start - 1] ?? '')) start--;
			}
			code.update(start, selector.start + ':global'.length, '');
		} else {
			code
				.remove(selector.start, selector.start + ':global('.length)
				.remove(selector.end - 1, selector.end);
		}
	}

	#escapeCommentClose(node: S.Rule): void {
		const original = this.#code.original;
		let escaped = false;
		let inComment = false;
		for (let i = node.start; i < node.end; i++) {
			if (escaped) {
				escaped = false;
				continue;
			}
			const character = original[i];
			if (inComment) {
				if (character === '*' && original[i + 1] === '/') {
					this.#code.prependRight(++i, '\\');
					inComment = false;
				}
			} else if (character === '\\') {
				escaped = true;
			} else if (character === '/' && original[++i] === '*') {
				inComment = true;
			}
		}
	}
}
