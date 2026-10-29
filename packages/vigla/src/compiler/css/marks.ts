import type * as S from '../ir/style.ts';

export interface RelativeFacts {
	isGlobal: boolean;
	isGlobalLike: boolean;
	scoped: boolean;
}

export interface ComplexFacts {
	rule: S.Rule | null;
	used: boolean;
	isGlobal: boolean;
}

export interface RuleFacts {
	parent: S.Rule | null;
	hasGlobalSelectors: boolean;
	hasLocalSelectors: boolean;
	isGlobalBlock: boolean;
}

export interface Step {
	readonly facts: RelativeFacts;
	readonly combinator: S.Combinator | null;
	readonly selectors: readonly S.SimpleSelector[];
}

export class Marks {
	readonly #relative = new Map<S.RelativeSelector, RelativeFacts>();
	readonly #complex = new Map<S.ComplexSelector, ComplexFacts>();
	readonly #rules = new Map<S.Rule, RuleFacts>();

	relative(node: S.RelativeSelector): RelativeFacts {
		let facts = this.#relative.get(node);
		if (facts === undefined) {
			facts = { isGlobal: false, isGlobalLike: false, scoped: false };
			this.#relative.set(node, facts);
		}
		return facts;
	}

	complex(node: S.ComplexSelector): ComplexFacts {
		let facts = this.#complex.get(node);
		if (facts === undefined) {
			facts = { rule: null, used: false, isGlobal: false };
			this.#complex.set(node, facts);
		}
		return facts;
	}

	rule(node: S.Rule): RuleFacts {
		let facts = this.#rules.get(node);
		if (facts === undefined) {
			facts = {
				parent: null,
				hasGlobalSelectors: false,
				hasLocalSelectors: false,
				isGlobalBlock: false
			};
			this.#rules.set(node, facts);
		}
		return facts;
	}

	step(node: S.RelativeSelector): Step {
		return { facts: this.relative(node), combinator: node.combinator, selectors: node.selectors };
	}

	used(rule: S.Rule): boolean {
		return rule.prelude.children.some((selector) => this.complex(selector).used);
	}
}

export function isPseudo(selector: S.SimpleSelector | undefined, name: string): boolean {
	return selector?.type === 'PseudoClassSelector' && selector.name === name;
}

export function isGlobalBlockSelector(selector: S.SimpleSelector | undefined): boolean {
	return (
		selector?.type === 'PseudoClassSelector' && selector.name === 'global' && selector.args === null
	);
}

export function isUnscopedPseudoClass(selector: S.SimpleSelector): boolean {
	if (selector.type !== 'PseudoClassSelector') return false;
	const name = selector.name;
	const scoping =
		name === 'has' ||
		name === 'is' ||
		name === 'where' ||
		(name === 'not' &&
			selector.args !== null &&
			!selector.args.children.every((complex) => complex.children.length === 1));
	if (!scoping) return true;
	return (
		selector.args === null ||
		selector.args.children.every((complex) =>
			complex.children.every((relative) => isGlobal(relative))
		)
	);
}

export function isGlobal(relative: S.RelativeSelector | Step): boolean {
	const first = relative.selectors[0];
	if (first?.type !== 'PseudoClassSelector' || first.name !== 'global') return false;
	return (
		first.args === null ||
		relative.selectors.every(
			(selector) => isUnscopedPseudoClass(selector) || selector.type === 'PseudoElementSelector'
		)
	);
}

export function isOuterGlobal(relative: S.RelativeSelector | Step): boolean {
	const first = relative.selectors[0];
	if (first?.type !== 'PseudoClassSelector' || first.name !== 'global') return false;
	return (
		first.args === null ||
		relative.selectors.every(
			(selector) =>
				selector.type === 'PseudoClassSelector' || selector.type === 'PseudoElementSelector'
		)
	);
}

export function parentRules(marks: Marks, rule: S.Rule | null): S.Rule[] {
	const rules: S.Rule[] = [];
	for (let current = rule; current !== null; current = marks.rule(current).parent) {
		rules.push(current);
	}
	return rules;
}

const prefix = /^-((webkit)|(moz)|(o)|(ms))-/;

export function withoutPrefix(name: string): string {
	return name.replace(prefix, '');
}

export function isKeyframes(node: S.Atrule): boolean {
	return withoutPrefix(node.name) === 'keyframes';
}
