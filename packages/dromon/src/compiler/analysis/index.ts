import type * as ES from 'estree';
import { walk } from '../ir/estree.ts';
import type { Attribute, Fragment, KeyedList, Node, UnkeyedList } from '../ir/nodes.ts';
import type { ComponentUnit, ModuleUnit, Runes } from '../ir/port.ts';
import { Scopes, spanOf, unsupported, type Binding, type Scope } from './scope.ts';
import { clean } from './whitespace.ts';

export type { Binding, BindingKind } from './scope.ts';
export { patternNames, spanOf, unsupported } from './scope.ts';

export interface Preserve {
	readonly whitespace: boolean;
	readonly comments: boolean;
}

export interface ScriptAnalysis {
	readonly references: ReadonlyMap<ES.Identifier, Binding>;
	readonly declarations: ReadonlyMap<ES.Identifier, Binding>;
	readonly runes: Runes;
	readonly names: ReadonlySet<string>;
}

export interface ComponentAnalysis extends ScriptAnalysis {
	readonly unit: ComponentUnit;
	readonly items: ReadonlyMap<KeyedList | UnkeyedList, Binding>;
	readonly fragments: ReadonlyMap<Fragment, readonly Node[]>;
	readonly root: readonly Node[];
}

export interface ModuleAnalysis extends ScriptAnalysis {
	readonly unit: ModuleUnit;
}

function collectNames(node: ES.Node, names: Set<string>): void {
	walk(node, (child) => {
		if (child.type === 'Identifier') names.add(child.name);
	});
}

const supportedRunes = new Set(['$state', '$state.raw', '$derived', '$derived.by']);

function checkRunes(runes: Runes, program: ES.Program | null): void {
	const placed = new Set<ES.Node>();
	if (program !== null) {
		walk(program, (node) => {
			if (node.type === 'VariableDeclarator' && node.init?.type === 'CallExpression') {
				placed.add(node.init.callee);
			}
		});
	}
	for (const [callee, rune] of runes) {
		if (!supportedRunes.has(rune)) throw unsupported(spanOf(callee), `The ${rune} rune`);
		if (!placed.has(callee))
			throw unsupported(spanOf(callee), 'A rune outside a variable declaration');
	}
}

export function analyzeModule(unit: ModuleUnit): ModuleAnalysis {
	checkRunes(unit.runes, unit.program);
	const scopes = new Scopes(unit.runes);
	const scope = scopes.root(null);
	scopes.owned.set(unit.program, scope);
	scopes.declare(unit.program, scope);
	scopes.resolve(unit.program, scope);
	const names = new Set<string>();
	collectNames(unit.program, names);
	return {
		unit,
		references: scopes.references,
		declarations: scopes.declarations,
		runes: unit.runes,
		names
	};
}

class Template {
	readonly scopes: Scopes;
	readonly preserve: Preserve;
	readonly names: Set<string>;
	readonly items = new Map<KeyedList | UnkeyedList, Binding>();
	readonly fragments = new Map<Fragment, readonly Node[]>();

	constructor(scopes: Scopes, preserve: Preserve, names: Set<string>) {
		this.scopes = scopes;
		this.preserve = preserve;
		this.names = names;
	}

	expression(expression: ES.Expression, scope: Scope): void {
		collectNames(expression, this.names);
		this.scopes.declare(expression, scope);
		this.scopes.resolve(expression, scope);
	}

	fragment(fragment: Fragment, parent: string | null, scope: Scope): readonly Node[] {
		const nodes = clean(fragment, parent, this.preserve);
		this.fragments.set(fragment, nodes);
		for (const node of nodes) this.node(node, scope);
		return nodes;
	}

	attribute(attribute: Attribute, scope: Scope): void {
		if (attribute.kind !== 'attribute')
			throw unsupported(attribute, `The ${attribute.kind} directive`);
		const { value } = attribute;
		if (value.kind === 'boolean') return;
		if (value.kind === 'text') {
			if (value.parts.some((part) => part.kind === 'expression')) {
				throw unsupported(attribute, 'An attribute value with expressions');
			}
			return;
		}
		if (!/^on[a-z]/.test(attribute.name)) throw unsupported(attribute, 'An expression attribute');
		this.expression(value.expression, scope);
	}

	node(node: Node, scope: Scope): void {
		switch (node.kind) {
			case 'text':
			case 'comment':
				return;
			case 'expression':
				this.expression(node.expression, scope);
				return;
			case 'element':
				for (const attribute of node.attributes) this.attribute(attribute, scope);
				this.fragment(node.body, node.name, scope);
				return;
			case 'branch':
				for (const arm of node.arms) {
					this.expression(arm.test, scope);
					this.fragment(arm.body, null, scope);
				}
				if (node.fallback !== null) this.fragment(node.fallback, null, scope);
				return;
			case 'keyed-list':
			case 'unkeyed-list': {
				if (node.index !== null) throw unsupported(node, 'An each block index');
				if (node.fallback !== null) throw unsupported(node, 'An each block fallback');
				if (node.item === null || node.item.type !== 'Identifier') {
					throw unsupported(node, 'An each block without a single item name');
				}
				this.expression(node.collection, scope);
				const inner = this.scopes.child(scope);
				this.names.add(node.item.name);
				this.items.set(node, this.scopes.bind(inner, node.item, 'item'));
				if (node.kind === 'keyed-list') this.expression(node.key, inner);
				this.fragment(node.body, null, inner);
				return;
			}
			default:
				throw unsupported(node, `The ${node.kind} node`);
		}
	}
}

export function analyzeComponent(unit: ComponentUnit, preserve: Preserve): ComponentAnalysis {
	if (unit.module !== null) throw unsupported(spanOf(unit.module), 'A module script');
	if (unit.options !== null) throw unsupported(unit.options, 'Component options');
	checkRunes(unit.runes, unit.instance);
	const scopes = new Scopes(unit.runes);
	const scope = scopes.root(null);
	const names = new Set<string>();
	if (unit.instance !== null) {
		scopes.owned.set(unit.instance, scope);
		scopes.declare(unit.instance, scope);
		collectNames(unit.instance, names);
	}
	const template = new Template(scopes, preserve, names);
	const root = template.fragment(unit.template, null, scope);
	if (unit.instance !== null) scopes.resolve(unit.instance, scope);
	return {
		unit,
		references: scopes.references,
		declarations: scopes.declarations,
		runes: unit.runes,
		names,
		items: template.items,
		fragments: template.fragments,
		root
	};
}
