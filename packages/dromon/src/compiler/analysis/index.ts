import type * as ES from 'estree';
import { walk } from '../ir/estree.ts';
import type { Element, Fragment, KeyedList, Namespace, Node, UnkeyedList } from '../ir/nodes.ts';
import {
	CompileError,
	type ComponentUnit,
	type ModuleUnit,
	type Rune,
	type Runes
} from '../ir/port.ts';
import { classFields, type ClassFields } from './classes.ts';
import { Scopes, spanOf, unsupported, type Binding } from './scope.ts';
import { collectNames, synchronous, Template, type ListFacts } from './template.ts';
import type { Preserve } from './whitespace.ts';

export type { ClassFields, FieldRune, StateField } from './classes.ts';
export type { Binding, BindingKind, Prop } from './scope.ts';
export type { ListFacts } from './template.ts';
export type { Preserve } from './whitespace.ts';
export { patternNames, spanOf, unsupported } from './scope.ts';

export interface ScriptAnalysis {
	readonly references: ReadonlyMap<ES.Identifier, Binding>;
	readonly declarations: ReadonlyMap<ES.Identifier, Binding>;
	readonly runes: Runes;
	readonly names: ReadonlySet<string>;
	readonly functions: ReadonlySet<Binding>;
	readonly classes: ClassFields;
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
				if (binding.kind === 'snippet' && !binding.reassigned) return;
				found = true;
				return false;
			}
			default:
				return;
		}
	});
	return found;
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

function checkRunes(runes: Runes, program: ES.Program | null, component: boolean): ClassFields {
	const placed = new Set<ES.Node>();
	const classes = classFields(runes, program, placed);
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
	return classes;
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
	const classes = checkRunes(unit.runes, unit.program, false);
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
		functions: scopes.functions,
		classes
	};
}

export function analyzeComponent(
	unit: ComponentUnit,
	preserve: Preserve,
	defaultNamespace: Namespace = 'html'
): ComponentAnalysis {
	if (unit.module !== null) throw unsupported(spanOf(unit.module), 'A module script');
	if (unit.options?.customElement) throw unsupported(unit.options, 'A custom element');
	const classes = checkRunes(unit.runes, unit.instance, true);
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
		classes,
		lists: template.lists,
		fragments: template.fragments,
		namespaces: template.namespaces,
		fragmentNamespaces: template.fragmentNamespaces,
		root,
		namespace
	};
}
