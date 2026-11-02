import type * as S from '../ir/style.ts';
import { complexSelectorsIn } from './analyze.ts';
import { attributeMatches } from './attributes.ts';
import {
	isGlobalBlockSelector,
	isOuterGlobal,
	isPseudo,
	isUnscopedPseudoClass,
	parentRules,
	type Marks,
	type Step
} from './marks.ts';
import { Direction, Relations } from './relations.ts';
import { hostName, type Host, type TemplateIndex } from './template.ts';

const whitelisted = new Map([
	['details', ['open']],
	['dialog', ['open']]
]);

const insensitiveAttributes = new Set([
	'accept-charset',
	'autocapitalize',
	'autocomplete',
	'behavior',
	'charset',
	'crossorigin',
	'decoding',
	'dir',
	'direction',
	'draggable',
	'enctype',
	'enterkeyhint',
	'fetchpriority',
	'formenctype',
	'formmethod',
	'formtarget',
	'hidden',
	'http-equiv',
	'inputmode',
	'kind',
	'loading',
	'method',
	'preload',
	'referrerpolicy',
	'rel',
	'rev',
	'role',
	'rules',
	'scope',
	'shape',
	'spellcheck',
	'target',
	'translate',
	'type',
	'valign',
	'wrap'
]);

const descendant: S.Combinator = { type: 'Combinator', name: ' ', start: -1, end: -1 };

function synthetic(selector: S.SimpleSelector): Step {
	return {
		facts: { isGlobal: false, isGlobalLike: false, scoped: false },
		combinator: null,
		selectors: [selector]
	};
}

const nesting = synthetic({ type: 'NestingSelector', name: '&', start: -1, end: -1 });
const any = synthetic({ type: 'TypeSelector', name: '*', start: -1, end: -1 });

const escaped = /\\(.)/g;

function unquote(value: string): string {
	if ((value[0] === value[value.length - 1] && value[0] === "'") || value[0] === '"') {
		return value.slice(1, value.length - 1);
	}
	return value;
}

function hasNesting(steps: readonly Step[]): boolean {
	let found = false;
	const visit = (selector: S.SimpleSelector): void => {
		if (found) return;
		if (selector.type === 'NestingSelector') found = true;
		else if (selector.type === 'PseudoClassSelector' && selector.args !== null) {
			complexSelectorsIn(selector.args, (complex) => {
				for (const relative of complex.children) relative.selectors.forEach(visit);
				return false;
			});
		} else if (selector.type === 'PseudoElementSelector' && selector.args !== undefined) {
			complexSelectorsIn(selector.args, (complex) => {
				for (const relative of complex.children) relative.selectors.forEach(visit);
				return false;
			});
		}
	};
	for (const step of steps) {
		step.selectors.forEach(visit);
		if (found) break;
	}
	return found;
}

export class Pruning {
	readonly scoped = new Set<Host>();
	readonly #marks: Marks;
	readonly #index: TemplateIndex;
	readonly #relations: Relations;

	constructor(marks: Marks, index: TemplateIndex) {
		this.#marks = marks;
		this.#index = index;
		this.#relations = new Relations(index);
	}

	sheet(sheet: S.StyleSheet): void {
		const hosts = this.#index.hosts.filter((host) => !this.#index.insideHead(host));
		const rule = (node: S.Rule): void => {
			for (const complex of node.prelude.children) this.#complex(complex, hosts);
			if (!this.#marks.rule(node).isGlobalBlock) node.block.children.forEach(child);
		};
		const child = (node: S.Rule | S.Atrule | S.Declaration): void => {
			if (node.type === 'Rule') rule(node);
			else if (node.type === 'Atrule' && node.block !== null) node.block.children.forEach(child);
		};
		sheet.children.forEach(child);
	}

	#complex(node: S.ComplexSelector, hosts: readonly Host[]): void {
		const steps = this.#relative(node);
		const facts = this.#marks.complex(node);
		const rule = facts.rule as S.Rule;
		if (this.#everyGlobal(steps, 0, steps.length, rule)) facts.used = true;
		for (const host of hosts) {
			if (this.#apply(steps, rule, host, Direction.Backward)) facts.used = true;
		}
	}

	#relative(node: S.ComplexSelector): Step[] {
		const steps = this.#truncate(node);
		const rule = this.#marks.complex(node).rule;
		if (rule !== null && this.#marks.rule(rule).parent !== null && steps.length > 0) {
			if (!hasNesting(steps)) {
				const first = steps[0] as Step;
				if (first.combinator === null) steps[0] = { ...first, combinator: descendant };
				steps.unshift(nesting);
			}
		}
		return steps;
	}

	#truncate(node: S.ComplexSelector): Step[] {
		let last = -1;
		node.children.forEach((child, index) => {
			const facts = this.#marks.relative(child);
			if (!facts.isGlobalLike && !isGlobalBlockSelector(child.selectors[0]) && !facts.isGlobal) {
				last = index;
			}
		});
		return node.children.slice(0, last + 1).map((child) => {
			const step = this.#marks.step(child);
			const root = child.selectors.some((selector) => isPseudo(selector, 'root'));
			if (!root || step.facts.isGlobalLike) return step;
			return { ...step, selectors: child.selectors.filter((s) => isPseudo(s, 'has')) };
		});
	}

	#apply(
		steps: readonly Step[],
		rule: S.Rule,
		host: Host,
		direction: Direction,
		from = 0,
		to = steps.length
	): boolean {
		if (from >= to) return false;
		const index = direction === Direction.Forward ? from : to - 1;
		const step = steps[index] as Step;
		const restFrom = direction === Direction.Forward ? from + 1 : from;
		const restTo = direction === Direction.Forward ? to : to - 1;
		const matched =
			this.#mightApply(step, rule, host, direction) &&
			this.#combinator(step, steps, restFrom, restTo, rule, host, direction);
		if (matched) {
			if (!isOuterGlobal(step)) step.facts.scoped = true;
			this.scoped.add(host);
		}
		return matched;
	}

	#combinator(
		step: Step,
		steps: readonly Step[],
		from: number,
		to: number,
		rule: S.Rule,
		host: Host,
		direction: Direction
	): boolean {
		const combinator =
			direction === Direction.Forward
				? from < to
					? steps[from]?.combinator
					: undefined
				: step.combinator;
		if (!combinator) return true;
		switch (combinator.name) {
			case ' ':
			case '>': {
				const adjacent = combinator.name === '>';
				const relatives =
					direction === Direction.Forward
						? this.#relations.descendants(host, adjacent)
						: this.#relations.ancestors(host, adjacent);
				let matched = false;
				for (const relative of relatives) {
					if (this.#apply(steps, rule, relative, direction, from, to)) matched = true;
				}
				return (
					matched ||
					(direction === Direction.Backward &&
						(!adjacent || relatives.length === 0) &&
						this.#everyGlobal(steps, from, to, rule))
				);
			}
			case '+':
			case '~': {
				const siblings = this.#relations.siblings(host, direction, combinator.name === '+');
				let matched = false;
				for (const sibling of siblings.keys()) {
					if (
						sibling.kind === 'render' ||
						sibling.kind === 'slot' ||
						sibling.kind === 'component'
					) {
						if (to - from === 1 && steps[from]?.facts.isGlobal) matched = true;
					} else if (this.#apply(steps, rule, sibling, direction, from, to)) {
						matched = true;
					}
				}
				return (
					matched ||
					(direction === Direction.Backward &&
						this.#relations.parent(host) === null &&
						this.#everyGlobal(steps, from, to, rule))
				);
			}
			default:
				return true;
		}
	}

	#everyGlobal(steps: readonly Step[], from: number, to: number, rule: S.Rule): boolean {
		for (let i = from; i < to; i++) if (!this.#global(steps[i] as Step, rule)) return false;
		return true;
	}

	#global(step: Step, rule: S.Rule): boolean {
		if (step.facts.isGlobal || step.facts.isGlobalLike) return true;
		let explicit = false;
		for (const selector of step.selectors) {
			let list: S.SelectorList | null = null;
			let canBeGlobal = false;
			let owner = rule;
			if (selector.type === 'PseudoClassSelector') {
				if ((selector.name === 'is' || selector.name === 'where') && selector.args) {
					list = selector.args;
				} else {
					canBeGlobal = isUnscopedPseudoClass(selector);
				}
			}
			if (selector.type === 'NestingSelector') {
				owner = this.#marks.rule(rule).parent as S.Rule;
				list = owner.prelude;
			}
			const globalInside =
				list?.children.some((complex) =>
					complex.children.every((relative) => this.#global(this.#marks.step(relative), owner))
				) ?? false;
			explicit ||= globalInside;
			if (!globalInside && !canBeGlobal) return false;
		}
		return explicit || step.selectors.length === 0;
	}

	#includeSelf(rule: S.Rule): boolean {
		const rules = parentRules(this.#marks, rule);
		if (
			rules.some((r) =>
				r.prelude.children.some((complex) =>
					complex.children.some((relative) => this.#global(this.#marks.step(relative), r))
				)
			)
		) {
			return true;
		}
		const root = rules[rules.length - 1] as S.Rule;
		return root.prelude.children.some((complex) =>
			complex.children.some((relative) =>
				relative.selectors.some(
					(s) =>
						s.type === 'PseudoClassSelector' &&
						(s.name === 'root' || (s.name === 'global' && s.args))
				)
			)
		);
	}

	#has(selector: S.PseudoClassSelector, rule: S.Rule, host: Host, self: boolean): boolean {
		let matched = false;
		for (const complex of (selector.args as S.SelectorList).children) {
			const [first, ...rest] = this.#truncate(complex);
			if (first === undefined) {
				this.#marks.complex(complex).used = true;
				matched = true;
				continue;
			}
			if (self) {
				const including = [first.combinator ? { ...first, combinator: null } : first, ...rest];
				if (this.#apply(including, rule, host, Direction.Forward)) {
					this.#marks.complex(complex).used = true;
					matched = true;
				}
			}
			const excluding = [
				any,
				first.combinator ? first : { ...first, combinator: descendant },
				...rest
			];
			if (this.#apply(excluding, rule, host, Direction.Forward)) {
				this.#marks.complex(complex).used = true;
				matched = true;
			}
		}
		return matched;
	}

	#mightApply(step: Step, rule: S.Rule, host: Host, direction: Direction): boolean {
		let self: boolean | undefined;
		for (const selector of step.selectors) {
			if (selector.type === 'PseudoClassSelector' && selector.name === 'has' && selector.args) {
				self ??= this.#includeSelf(rule);
				if (!this.#has(selector, rule, host, self)) return false;
				continue;
			}
			if (selector.type === 'Percentage' || selector.type === 'Nth') continue;
			const name = selector.name.includes('\\')
				? selector.name.replace(escaped, '$1')
				: selector.name;
			switch (selector.type) {
				case 'PseudoClassSelector': {
					if (name === 'host' || name === 'root') return false;
					if (name === 'global' && selector.args !== null && step.selectors.length === 1) {
						const complex = selector.args.children[0] as S.ComplexSelector;
						const inner = complex.children.map((relative) => this.#marks.step(relative));
						return this.#apply(inner, rule, host, Direction.Backward);
					}
					if (name === 'global' && selector.args === null) return true;
					if (name === 'not' && selector.args) {
						this.#not(selector.args, host);
						break;
					}
					if ((name === 'is' || name === 'where') && selector.args) {
						if (!this.#is(selector.args, rule, host)) return false;
					}
					break;
				}
				case 'PseudoElementSelector':
					break;
				case 'AttributeSelector': {
					const name = hostName(host);
					const allowed = name === null ? undefined : whitelisted.get(name.toLowerCase());
					const attribute = selector.name.toLowerCase();
					const insensitive =
						(selector.flags?.includes('i') ?? false) ||
						(!selector.flags?.includes('s') && insensitiveAttributes.has(attribute));
					if (
						!allowed?.includes(attribute) &&
						!attributeMatches(
							host,
							selector.name,
							selector.value && unquote(selector.value),
							selector.matcher,
							insensitive
						)
					) {
						return false;
					}
					break;
				}
				case 'ClassSelector':
					if (!attributeMatches(host, 'class', name, '~=', false)) return false;
					break;
				case 'IdSelector':
					if (!attributeMatches(host, 'id', name, '=', false)) return false;
					break;
				case 'TypeSelector':
					if (
						host.kind === 'element' &&
						host.name.toLowerCase() !== name.toLowerCase() &&
						name !== '*'
					) {
						return false;
					}
					break;
				case 'NestingSelector': {
					if (!this.#nesting(rule, host, direction)) return false;
					break;
				}
			}
		}
		return true;
	}

	#not(args: S.SelectorList, host: Host): void {
		for (const complex of args.children) {
			complexSelectorsIn(complex, (inner) => {
				this.#marks.complex(inner).used = true;
				return true;
			});
			const relative = this.#truncate(complex);
			if (complex.children.length > 1) {
				for (const step of relative) step.facts.scoped = true;
				for (let el: Host | null = host; el !== null; el = this.#relations.parent(el)) {
					this.scoped.add(el);
				}
			}
		}
	}

	#is(args: S.SelectorList, rule: S.Rule, host: Host): boolean {
		let matched = false;
		for (const complex of args.children) {
			const relative = this.#truncate(complex);
			if (relative.length === 0) {
				this.#marks.complex(complex).used = true;
				matched = true;
			} else if (this.#apply(relative, rule, host, Direction.Backward)) {
				this.#marks.complex(complex).used = true;
				matched = true;
			} else if (complex.children.length > 1) {
				this.#marks.complex(complex).used = true;
				matched = true;
				for (const step of relative) step.facts.scoped = true;
			}
		}
		return matched;
	}

	#nesting(rule: S.Rule, host: Host, direction: Direction): boolean {
		let matched = false;
		const parent = this.#marks.rule(rule).parent as S.Rule;
		for (const complex of parent.prelude.children) {
			if (
				this.#apply(this.#relative(complex), parent, host, direction) ||
				complex.children.every((relative) => this.#global(this.#marks.step(relative), parent))
			) {
				this.#marks.complex(complex).used = true;
				matched = true;
			}
		}
		return matched;
	}
}
