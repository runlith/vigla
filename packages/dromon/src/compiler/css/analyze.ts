import { fail } from '../analysis/validate/report.ts';
import type * as S from '../ir/style.ts';
import {
	isGlobal,
	isGlobalBlockSelector,
	isKeyframes,
	isPseudo,
	isUnscopedPseudoClass,
	type Marks
} from './marks.ts';

const viewTransitions = new Set([
	'view-transition',
	'view-transition-group',
	'view-transition-old',
	'view-transition-new',
	'view-transition-image-pair'
]);

export function complexSelectorsIn(
	node: S.SimpleSelector | S.SelectorList | S.ComplexSelector | S.RelativeSelector,
	visit: (complex: S.ComplexSelector) => boolean
): void {
	switch (node.type) {
		case 'SelectorList':
			for (const complex of node.children) complexSelectorsIn(complex, visit);
			return;
		case 'ComplexSelector':
			if (visit(node)) for (const relative of node.children) complexSelectorsIn(relative, visit);
			return;
		case 'RelativeSelector':
			for (const selector of node.selectors) complexSelectorsIn(selector, visit);
			return;
		case 'PseudoClassSelector':
			if (node.args !== null) complexSelectorsIn(node.args, visit);
			return;
		case 'PseudoElementSelector':
			if (node.args !== undefined) complexSelectorsIn(node.args, visit);
			return;
		default:
			return;
	}
}

export class Analysis {
	readonly keyframes: string[] = [];
	hasGlobal = false;
	readonly #marks: Marks;

	constructor(marks: Marks) {
		this.#marks = marks;
	}

	sheet(sheet: S.StyleSheet): void {
		for (const child of sheet.children) this.#child(child, null);
	}

	#child(node: S.Rule | S.Atrule | S.Declaration, rule: S.Rule | null): void {
		if (node.type === 'Rule') this.#rule(node, rule);
		else if (node.type === 'Atrule') this.#atrule(node, rule);
	}

	#unscoped(rule: S.Rule | null): boolean {
		for (let current = rule; current !== null; current = this.#marks.rule(current).parent) {
			if (!this.#marks.rule(current).hasGlobalSelectors) return false;
		}
		return true;
	}

	inGlobalBlock(rule: S.Rule | null): boolean {
		for (let current = rule; current !== null; current = this.#marks.rule(current).parent) {
			if (this.#marks.rule(current).isGlobalBlock) return true;
		}
		return false;
	}

	#atrule(node: S.Atrule, rule: S.Rule | null): void {
		if (isKeyframes(node)) {
			if (!node.prelude.startsWith('-global-') && !this.inGlobalBlock(rule)) {
				this.keyframes.push(node.prelude);
			} else if (node.prelude.startsWith('-global-')) {
				this.hasGlobal ||= this.#unscoped(rule);
			}
		}
		if (node.block !== null) for (const child of node.block.children) this.#child(child, rule);
	}

	#rule(node: S.Rule, parent: S.Rule | null): void {
		const facts = this.#marks.rule(node);
		facts.parent = parent;
		for (const complex of node.prelude.children) {
			let globalBlock = false;
			complex.children.forEach((child, index) => {
				const at = child.selectors.findIndex(isGlobalBlockSelector);
				if (globalBlock) this.#marks.relative(child).isGlobalLike = true;
				if (at === 0) {
					const modifier = child.selectors[1];
					if (modifier !== undefined && index === 0 && parent === null) {
						fail('css_global_block_invalid_modifier_start', modifier);
					}
					facts.isGlobalBlock = globalBlock = true;
					for (const selector of child.selectors.slice(1)) {
						complexSelectorsIn(selector, (inner) => {
							this.#marks.complex(inner).used = true;
							return false;
						});
					}
					if (child.combinator !== null && child.combinator.name !== ' ') {
						fail('css_global_block_invalid_combinator', child, { name: child.combinator.name });
					}
					const declaration = node.block.children.find((entry) => entry.type === 'Declaration');
					const lone = complex.children.length === 1 && complex.children[0]?.selectors.length === 1;
					if (lone && node.prelude.children.length > 1) {
						fail('css_global_block_invalid_list', node.prelude);
					}
					if (declaration !== undefined && node.prelude.children.length === 1 && lone) {
						fail('css_global_block_invalid_declaration', declaration);
					}
				} else if (at !== -1) {
					fail('css_global_block_invalid_modifier', child.selectors[at] ?? child);
				}
			});
			if (facts.isGlobalBlock && !globalBlock) fail('css_global_block_invalid_list', node.prelude);
		}

		for (const complex of node.prelude.children) this.#complex(complex, node, false);

		for (const selector of node.prelude.children) {
			const global = this.#marks.complex(selector).isGlobal;
			facts.hasGlobalSelectors ||= global;
			facts.hasLocalSelectors ||= !global;
		}

		this.hasGlobal ||=
			facts.hasGlobalSelectors &&
			node.block.children.some((child) => child.type === 'Declaration') &&
			this.#unscoped(parent);

		for (const child of node.block.children) this.#child(child, node);
	}

	#complex(node: S.ComplexSelector, rule: S.Rule, nested: boolean): void {
		for (const relative of node.children) this.#relative(relative, node, rule, nested);

		const global = node.children.find((relative) => isGlobal(relative));
		if (global !== undefined) {
			const pseudo = global.selectors[0] as S.PseudoClassSelector;
			if (nested && pseudo.args === null) fail('css_global_block_invalid_placement', pseudo);
			const index = node.children.indexOf(global);
			if (pseudo.args !== null && index !== 0 && index !== node.children.length - 1) {
				for (const after of node.children.slice(index + 1)) {
					if (!isGlobal(after)) fail('css_global_invalid_placement', pseudo);
				}
			}
		}

		for (const relative of node.children) {
			relative.selectors.forEach((selector, index) => {
				if (selector.type !== 'PseudoClassSelector' || selector.name !== 'global') return;
				const first = selector.args?.children[0]?.children[0];
				if (first?.selectors[0]?.type === 'TypeSelector' && index !== 0) {
					fail('css_global_invalid_selector_list', selector);
				}
				const following = relative.selectors[index + 1];
				if (following?.type === 'TypeSelector') {
					fail('css_type_selector_invalid_placement', following);
				}
				if (
					selector.args !== null &&
					selector.args.children.length > 1 &&
					(node.children.length > 1 || relative.selectors.length > 1)
				) {
					fail('css_global_invalid_selector', selector);
				}
			});
		}

		const facts = this.#marks.complex(node);
		facts.rule = rule;
		facts.isGlobal = node.children.every((relative) => {
			const own = this.#marks.relative(relative);
			return own.isGlobal || own.isGlobalLike;
		});
		facts.used ||= facts.isGlobal;

		const parent = this.#marks.rule(rule).parent;
		if (parent !== null && node.children[0]?.selectors[0]?.type === 'NestingSelector') {
			const first = node.children[0].selectors[1];
			const unscopedNesting = first?.type !== 'PseudoClassSelector' || isUnscopedPseudoClass(first);
			const parentGlobal = parent.prelude.children.some((child) => {
				const only = child.children[0];
				return (
					child.children.length === 1 && only !== undefined && this.#marks.relative(only).isGlobal
				);
			});
			if (unscopedNesting && parentGlobal) facts.used = true;
		}
	}

	#relative(
		node: S.RelativeSelector,
		complex: S.ComplexSelector,
		rule: S.Rule,
		nested: boolean
	): void {
		if (
			node.combinator !== null &&
			this.#marks.rule(rule).parent === null &&
			complex.children[0] === node &&
			!nested
		) {
			fail('css_selector_invalid', node.combinator);
		}

		const facts = this.#marks.relative(node);
		facts.isGlobal = node.selectors.length >= 1 && isGlobal(node);

		const first = node.selectors[0];
		if (
			first !== undefined &&
			node.selectors.every(
				(selector) =>
					selector.type === 'PseudoClassSelector' || selector.type === 'PseudoElementSelector'
			)
		) {
			facts.isGlobalLike ||=
				(first.type === 'PseudoClassSelector' && first.name === 'host') ||
				(first.type === 'PseudoElementSelector' && viewTransitions.has(first.name));
		}

		facts.isGlobalLike ||=
			node.selectors.some((selector) => isPseudo(selector, 'root')) &&
			!node.selectors.some((selector) => isPseudo(selector, 'has'));

		if (facts.isGlobalLike || facts.isGlobal) {
			for (const selector of node.selectors) {
				complexSelectorsIn(selector, (inner) => {
					this.#marks.complex(inner).used = true;
					return true;
				});
			}
		}

		for (const selector of node.selectors) {
			if (selector.type === 'PseudoClassSelector' && selector.args !== null) {
				for (const inner of selector.args.children) this.#complex(inner, rule, true);
			} else if (selector.type === 'NestingSelector') {
				this.#nesting(selector, rule);
			}
		}
	}

	#nesting(node: S.NestingSelector, rule: S.Rule): void {
		const parent = this.#marks.rule(rule).parent;
		if (parent === null) {
			const children = rule.prelude.children;
			const selectors = children[0]?.children[0]?.selectors ?? [];
			const only = selectors[0];
			if (
				children.length > 1 ||
				selectors.length > 1 ||
				only?.type !== 'PseudoClassSelector' ||
				only.name !== 'global' ||
				only.args?.children[0]?.children[0]?.selectors[0] !== node
			) {
				fail('css_nesting_selector_invalid_placement', node);
			}
		} else {
			const outer = this.#marks.rule(parent);
			const lone = parent.prelude.children[0];
			if (
				outer.isGlobalBlock &&
				outer.parent === null &&
				lone?.children.length === 1 &&
				lone.children[0]?.selectors.length === 1
			) {
				fail('css_global_block_invalid_modifier_start', node);
			}
		}
	}
}
