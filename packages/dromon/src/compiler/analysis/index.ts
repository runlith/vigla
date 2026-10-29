import type * as ES from 'estree';
import { walk } from '../ir/estree.ts';
import type { Attribute, Fragment, KeyedList, Node, UnkeyedList } from '../ir/nodes.ts';
import { CompileError, type ComponentUnit, type ModuleUnit, type Runes } from '../ir/port.ts';
import { Scopes, spanOf, unsupported, type Binding, type Scope } from './scope.ts';
import { clean, preserving, type Preserve } from './whitespace.ts';

export type { Binding, BindingKind } from './scope.ts';
export type { Preserve } from './whitespace.ts';
export { patternNames, spanOf, unsupported } from './scope.ts';

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

export function isSignal(binding: Binding): boolean {
	switch (binding.kind) {
		case 'derived':
		case 'item':
			return true;
		case 'state':
		case 'raw-state':
			return binding.reassigned;
		default:
			return false;
	}
}

function collectNames(node: ES.Node, names: Set<string>): void {
	walk(node, (child) => {
		if (child.type === 'Identifier') names.add(child.name);
	});
}

function synchronous(node: ES.Node, where: string): void {
	walk(node, (child) => {
		if (
			child.type === 'FunctionDeclaration' ||
			child.type === 'FunctionExpression' ||
			child.type === 'ArrowFunctionExpression'
		) {
			return false;
		}
		if (child.type === 'AwaitExpression' || (child.type === 'ForOfStatement' && child.await)) {
			throw unsupported(spanOf(child), `An await ${where}`);
		}
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

function exported(name: ES.Identifier, binding: Binding | undefined): void {
	if (binding === undefined) return;
	const span = spanOf(name);
	if (binding.kind === 'derived') {
		throw new CompileError({
			code: 'derived_invalid_export',
			message:
				'Cannot export derived state from a module. To expose the current derived value, export a function returning its value',
			...span
		});
	}
	if ((binding.kind === 'state' || binding.kind === 'raw-state') && binding.reassigned) {
		throw new CompileError({
			code: 'state_invalid_export',
			message:
				"Cannot export state from a module if it is reassigned. Either export a function returning the state value or only mutate the state value's properties",
			...span
		});
	}
}

function checkExports(program: ES.Program, scopes: Scopes): void {
	for (const statement of program.body) {
		if (statement.type !== 'ExportNamedDeclaration') continue;
		if (statement.declaration?.type === 'VariableDeclaration') {
			for (const declarator of statement.declaration.declarations) {
				if (declarator.id.type === 'Identifier') {
					exported(declarator.id, scopes.declarations.get(declarator.id));
				}
			}
		}
		if (statement.source == null) {
			for (const specifier of statement.specifiers) {
				if (specifier.local.type === 'Identifier') {
					exported(specifier.local, scopes.references.get(specifier.local));
				}
			}
		}
	}
}

export function analyzeModule(unit: ModuleUnit): ModuleAnalysis {
	checkRunes(unit.runes, unit.program);
	const scopes = new Scopes(unit.runes);
	const scope = scopes.root(null);
	scopes.owned.set(unit.program, scope);
	scopes.declare(unit.program, scope);
	scopes.resolve(unit.program, scope);
	checkExports(unit.program, scopes);
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

const foreign = new Set(['svg', 'math']);

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
		synchronous(expression, 'in the template');
		collectNames(expression, this.names);
		this.scopes.declare(expression, scope);
		this.scopes.resolve(expression, scope);
	}

	fragment(
		fragment: Fragment,
		parent: string | null,
		scope: Scope,
		inherited: boolean
	): readonly Node[] {
		const kept = inherited || (parent !== null && preserving.has(parent));
		const nodes = clean(fragment, parent, {
			whitespace: this.preserve.whitespace || kept,
			comments: this.preserve.comments
		});
		this.fragments.set(fragment, nodes);
		for (const node of nodes) this.node(node, scope, kept);
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
		if (/capture$/.test(attribute.name)) throw unsupported(attribute, 'A capture event handler');
		this.expression(value.expression, scope);
	}

	node(node: Node, scope: Scope, kept: boolean): void {
		switch (node.kind) {
			case 'text':
			case 'comment':
				return;
			case 'expression':
				this.expression(node.expression, scope);
				return;
			case 'element':
				if (foreign.has(node.name.toLowerCase()))
					throw unsupported(node, 'An SVG or MathML element');
				for (const attribute of node.attributes) this.attribute(attribute, scope);
				this.fragment(node.body, node.name, scope, kept);
				return;
			case 'branch':
				for (const arm of node.arms) {
					this.expression(arm.test, scope);
					this.fragment(arm.body, null, scope, kept);
				}
				if (node.fallback !== null) this.fragment(node.fallback, null, scope, kept);
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
				this.fragment(node.body, null, inner, kept);
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
		synchronous(unit.instance, 'at the top level of a component script');
		scopes.owned.set(unit.instance, scope);
		scopes.declare(unit.instance, scope);
		collectNames(unit.instance, names);
	}
	const template = new Template(scopes, preserve, names);
	const root = template.fragment(unit.template, null, scope, false);
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
