import type * as ES from 'estree';
import { isMathml, isSvg } from '../../shared/html.ts';
import { walk } from '../ir/estree.ts';
import type {
	Attribute,
	Element,
	Fragment,
	KeyedList,
	Namespace,
	Node,
	UnkeyedList
} from '../ir/nodes.ts';
import {
	CompileError,
	type ComponentUnit,
	type ModuleUnit,
	type Rune,
	type Runes
} from '../ir/port.ts';
import { Scopes, spanOf, unsupported, type Binding, type Scope } from './scope.ts';
import { clean, preserving, type Preserve } from './whitespace.ts';

export type { Binding, BindingKind, Prop } from './scope.ts';
export type { Preserve } from './whitespace.ts';
export { patternNames, spanOf, unsupported } from './scope.ts';

export interface ScriptAnalysis {
	readonly references: ReadonlyMap<ES.Identifier, Binding>;
	readonly declarations: ReadonlyMap<ES.Identifier, Binding>;
	readonly runes: Runes;
	readonly names: ReadonlySet<string>;
	readonly functions: ReadonlySet<Binding>;
}

export interface ListFacts {
	readonly item: Binding;
	readonly index: Binding | null;
}

export interface ComponentAnalysis extends ScriptAnalysis {
	readonly unit: ComponentUnit;
	readonly lists: ReadonlyMap<KeyedList | UnkeyedList, ListFacts>;
	readonly fragments: ReadonlyMap<Fragment, readonly Node[]>;
	readonly namespaces: ReadonlyMap<Element, Namespace>;
	readonly fragmentNamespaces: ReadonlyMap<Fragment, Namespace>;
	readonly root: readonly Node[];
	readonly namespace: Namespace;
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

export function dynamic(analysis: ScriptAnalysis, expression: ES.Node): boolean {
	let found = false;
	walk(expression, (node) => {
		if (found) return false;
		switch (node.type) {
			case 'CallExpression':
			case 'NewExpression':
			case 'TaggedTemplateExpression':
			case 'AwaitExpression':
			case 'ImportExpression':
				found = true;
				return false;
			case 'Identifier': {
				const binding = analysis.references.get(node);
				if (binding === undefined) return;
				if (binding.constant && !binding.reassigned) return;
				if (analysis.functions.has(binding)) return;
				found = true;
				return false;
			}
			default:
				return;
		}
	});
	return found;
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

const declaring = new Set<Rune>([
	'$state',
	'$state.raw',
	'$derived',
	'$derived.by',
	'$props',
	'$props.id'
]);

const supported = new Set<Rune>([
	...declaring,
	'$bindable',
	'$effect',
	'$effect.pre',
	'$effect.root',
	'$effect.tracking',
	'$state.snapshot'
]);

function checkRunes(runes: Runes, program: ES.Program | null, component: boolean): void {
	const placed = new Set<ES.Node>();
	const statements = new Set<ES.Node>();
	if (program !== null) {
		walk(program, (node, parent) => {
			if (node.type === 'VariableDeclarator' && node.init?.type === 'CallExpression') {
				placed.add(node.init.callee);
			}
			if (
				node.type === 'CallExpression' &&
				parent?.type === 'ExpressionStatement' &&
				parent.expression === node
			) {
				statements.add(node.callee);
			}
		});
	}
	for (const [callee, rune] of runes) {
		if (!supported.has(rune)) throw unsupported(spanOf(callee), `The ${rune} rune`);
		if ((rune === '$props' || rune === '$props.id') && !component) {
			throw unsupported(spanOf(callee), `The ${rune} rune outside a component`);
		}
		if (declaring.has(rune) && !placed.has(callee))
			throw unsupported(spanOf(callee), 'A rune outside a variable declaration');
		if ((rune === '$effect' || rune === '$effect.pre') && !statements.has(callee)) {
			throw unsupported(spanOf(callee), `The ${rune} rune outside an expression statement`);
		}
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
	checkRunes(unit.runes, unit.program, false);
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
		names,
		functions: scopes.functions
	};
}

function childNamespace(element: Element, namespace: Namespace): Namespace {
	if (element.name === 'foreignObject') return 'html';
	return namespace;
}

function elementNamespace(name: string, parent: Namespace): Namespace {
	if (name === 'svg') return 'svg';
	if (name === 'math') return 'mathml';
	return parent;
}

function inferred(nodes: readonly Node[], fallback: Namespace): Namespace {
	let found: Namespace | null = null;
	for (const node of nodes) {
		if (node.kind !== 'element') continue;
		const guessed = isSvg(node.name) ? 'svg' : isMathml(node.name) ? 'mathml' : 'html';
		if (guessed === 'html') return 'html';
		found = found === null || found === guessed ? guessed : 'html';
	}
	return found ?? fallback;
}

class Template {
	readonly scopes: Scopes;
	readonly preserve: Preserve;
	readonly names: Set<string>;
	readonly lists = new Map<KeyedList | UnkeyedList, ListFacts>();
	readonly fragments = new Map<Fragment, readonly Node[]>();
	readonly namespaces = new Map<Element, Namespace>();
	readonly fragmentNamespaces = new Map<Fragment, Namespace>();

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
		parent: Element | null,
		scope: Scope,
		inherited: boolean,
		namespace: Namespace,
		infer = parent === null
	): readonly Node[] {
		const name = parent?.name ?? null;
		const kept = inherited || (name !== null && preserving.has(name));
		const own = infer ? inferred(fragment.nodes, namespace) : namespace;
		const foreign = own === 'svg' && name !== 'text' && !this.inText;
		const nodes = clean(
			fragment,
			name,
			{ whitespace: this.preserve.whitespace || kept, comments: this.preserve.comments },
			foreign
		);
		this.fragments.set(fragment, nodes);
		this.fragmentNamespaces.set(fragment, own);
		for (const node of nodes) this.node(node, scope, kept, own);
		return nodes;
	}

	inText = false;

	attribute(attribute: Attribute, scope: Scope): void {
		switch (attribute.kind) {
			case 'attribute': {
				const { value } = attribute;
				if (value.kind === 'expression') this.expression(value.expression, scope);
				else if (value.kind === 'text') {
					for (const part of value.parts) {
						if (part.kind === 'expression') this.expression(part.expression, scope);
					}
				}
				return;
			}
			case 'spread':
				this.expression(attribute.expression, scope);
				return;
			case 'class':
				this.expression(attribute.expression, scope);
				return;
			case 'style': {
				const { value } = attribute;
				if (value.kind === 'expression') this.expression(value.expression, scope);
				else if (value.kind === 'text') {
					for (const part of value.parts) {
						if (part.kind === 'expression') this.expression(part.expression, scope);
					}
				}
				return;
			}
			default:
				throw unsupported(attribute, `The ${attribute.kind} directive`);
		}
	}

	node(node: Node, scope: Scope, kept: boolean, namespace: Namespace): void {
		switch (node.kind) {
			case 'text':
			case 'comment':
				return;
			case 'expression':
				this.expression(node.expression, scope);
				return;
			case 'element': {
				const own = elementNamespace(node.name, namespace);
				this.namespaces.set(node, own);
				for (const attribute of node.attributes) this.attribute(attribute, scope);
				const text = this.inText;
				if (node.name === 'text') this.inText = true;
				this.fragment(node.body, node, scope, kept, childNamespace(node, own));
				this.inText = text;
				return;
			}
			case 'branch':
				for (const arm of node.arms) {
					this.expression(arm.test, scope);
					this.fragment(arm.body, null, scope, kept, namespace);
				}
				if (node.fallback !== null) this.fragment(node.fallback, null, scope, kept, namespace);
				return;
			case 'keyed-list':
			case 'unkeyed-list': {
				if (node.item === null || node.item.type !== 'Identifier') {
					throw unsupported(node, 'An each block without a single item name');
				}
				this.expression(node.collection, scope);
				const inner = this.scopes.child(scope);
				this.names.add(node.item.name);
				const item = this.scopes.bind(inner, node.item, { kind: 'item' });
				let index: Binding | null = null;
				if (node.index !== null) {
					this.names.add(node.index.name);
					index = this.scopes.bind(inner, node.index, { kind: 'index' });
				}
				this.lists.set(node, { item, index });
				if (node.kind === 'keyed-list') this.expression(node.key, inner);
				this.fragment(node.body, null, inner, kept, namespace);
				if (node.fallback !== null) this.fragment(node.fallback, null, scope, kept, namespace);
				return;
			}
			default:
				throw unsupported(node, `The ${node.kind} node`);
		}
	}
}

export function analyzeComponent(
	unit: ComponentUnit,
	preserve: Preserve,
	defaultNamespace: Namespace = 'html'
): ComponentAnalysis {
	if (unit.module !== null) throw unsupported(spanOf(unit.module), 'A module script');
	if (unit.options?.customElement) throw unsupported(unit.options, 'A custom element');
	checkRunes(unit.runes, unit.instance, true);
	const scopes = new Scopes(unit.runes);
	const scope = scopes.root(null);
	const names = new Set<string>();
	if (unit.instance !== null) {
		synchronous(unit.instance, 'at the top level of a component script');
		scopes.owned.set(unit.instance, scope);
		scopes.declare(unit.instance, scope);
		collectNames(unit.instance, names);
	}
	const namespace = unit.options?.namespace ?? defaultNamespace;
	const template = new Template(scopes, preserve, names);
	const root = template.fragment(
		unit.template,
		null,
		scope,
		unit.options?.preserveWhitespace ?? false,
		namespace,
		namespace === 'html'
	);
	if (unit.instance !== null) scopes.resolve(unit.instance, scope);
	return {
		unit,
		references: scopes.references,
		declarations: scopes.declarations,
		runes: unit.runes,
		names,
		functions: scopes.functions,
		lists: template.lists,
		fragments: template.fragments,
		namespaces: template.namespaces,
		fragmentNamespaces: template.fragmentNamespaces,
		root,
		namespace
	};
}
