import type * as ES from 'estree';
import { walk } from '../ir/estree.ts';
import type {
	DynamicElement,
	Element,
	Fragment,
	KeyedList,
	Namespace,
	Node,
	Snippet,
	Special,
	Title,
	UnkeyedList
} from '../ir/nodes.ts';
import {
	CompileError,
	type ComponentUnit,
	type ExternalBinding,
	type ModuleUnit,
	type Rune,
	type Runes
} from '../ir/port.ts';
import { classFields, type ClassFields, type StateField } from './classes.ts';
import { Scopes, spanOf, unsupported, type Binding } from './scope.ts';
import { collectNames, hasAwait, Template, type ListFacts } from './template.ts';
import type { Preserve } from './whitespace.ts';

export type { ClassFields, FieldRune, StateField } from './classes.ts';
export type { Binding, BindingKind, Prop } from './scope.ts';
export type { ListFacts } from './template.ts';
export {
	asyncStep,
	awaits,
	declaring,
	hasAwait,
	hoisted,
	ownExpressions,
	pendingAwaits
} from './template.ts';
export type { AsyncStep, Settled } from './template.ts';
export type { Preserve } from './whitespace.ts';
export { patternNames, spanOf, unsupported } from './scope.ts';

export interface ScriptAnalysis {
	readonly references: ReadonlyMap<ES.Identifier, Binding>;
	readonly declarations: ReadonlyMap<ES.Identifier, Binding>;
	readonly runes: Runes;
	readonly names: ReadonlySet<string>;
	readonly functions: ReadonlySet<Binding>;
	readonly classes: ClassFields;
	readonly externals: ReadonlyMap<ES.Identifier, ExternalBinding>;
}

export interface ComponentAnalysis extends ScriptAnalysis {
	readonly unit: ComponentUnit;
	readonly lists: ReadonlyMap<KeyedList | UnkeyedList, ListFacts>;
	readonly fragments: ReadonlyMap<Fragment, readonly Node[]>;
	readonly namespaces: ReadonlyMap<Element | DynamicElement, Namespace>;
	readonly fragmentNamespaces: ReadonlyMap<Fragment, Namespace>;
	readonly ignored: ReadonlyMap<Node, ReadonlySet<string>>;
	readonly separate: ReadonlyMap<Fragment, readonly (Special | Title)[]>;
	readonly lifted: ReadonlySet<Snippet>;
	readonly root: readonly Node[];
	readonly namespace: Namespace;
	readonly asynchronous: boolean;
}

export interface ModuleAnalysis extends ScriptAnalysis {
	readonly unit: ModuleUnit;
}

export function isSignal(binding: Binding): boolean {
	switch (binding.kind) {
		case 'derived':
		case 'item':
		case 'template-constant':
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
				if (analysis.externals.has(node)) {
					found = true;
					return false;
				}
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
	'$effect.pending',
	'$state.snapshot',
	'$state.eager',
	'$inspect',
	'$inspect.trace'
]);

export interface Inspection {
	readonly args: readonly ES.Expression[];
	readonly inspector: ES.Expression | null;
}

export function inspection(runes: Runes, call: ES.CallExpression): Inspection | null {
	const values = (args: readonly (ES.Expression | ES.SpreadElement)[]): ES.Expression[] =>
		args.filter((argument): argument is ES.Expression => argument.type !== 'SpreadElement');
	if (runes.get(call.callee) === '$inspect')
		return { args: values(call.arguments), inspector: null };
	const callee = call.callee;
	if (
		callee.type === 'MemberExpression' &&
		!callee.computed &&
		callee.property.type === 'Identifier' &&
		callee.property.name === 'with' &&
		callee.object.type === 'CallExpression' &&
		runes.get(callee.object.callee) === '$inspect'
	) {
		const [inspector] = values(call.arguments);
		return { args: values(callee.object.arguments), inspector: inspector ?? null };
	}
	return null;
}

function checkRunes(
	runes: Runes,
	programs: readonly (ES.Program | null)[],
	component: boolean,
	placed = new Set<ES.Node>(),
	statements = new Set<ES.Node>()
): ClassFields {
	const classes = new Map<ES.ClassBody, ReadonlyMap<string, StateField>>();
	for (const program of programs) {
		if (program === null) continue;
		for (const [body, fields] of classFields(runes, program, placed)) classes.set(body, fields);
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
	const classes = checkRunes(unit.runes, [unit.program], false);
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
		classes,
		externals: new Map()
	};
}

export function analyzeComponent(
	unit: ComponentUnit,
	preserve: Preserve,
	defaultNamespace: Namespace = 'html'
): ComponentAnalysis {
	if (unit.options?.customElement) throw unsupported(unit.options, 'A custom element');
	const runes = new Map(unit.runes);
	const externalReferences = new Set(
		(unit.externals ?? []).flatMap((binding) => [...binding.references])
	);
	for (const callee of runes.keys()) {
		if (
			(callee.type === 'Identifier' && externalReferences.has(callee)) ||
			(callee.type === 'MemberExpression' &&
				callee.object.type === 'Identifier' &&
				externalReferences.has(callee.object))
		)
			runes.delete(callee);
	}
	const scopes = new Scopes(runes);
	const top = scopes.root(null);
	const scope = scopes.root(top);
	const names = new Set<string>();
	if (unit.module !== null) {
		scopes.owned.set(unit.module, top);
		scopes.declare(unit.module, top);
		collectNames(unit.module, names);
	}
	if (unit.instance !== null) {
		scopes.owned.set(unit.instance, scope);
		scopes.declare(unit.instance, scope);
		collectNames(unit.instance, names);
	}
	for (const binding of unit.externals ?? []) {
		for (const reference of binding.references) {
			if (!scope.bindings.has(reference.name))
				scopes.bind(scope, { type: 'Identifier', name: reference.name }, { kind: 'external' });
		}
	}
	const namespace = unit.options?.namespace ?? defaultNamespace;
	const template = new Template(scopes, preserve, names, unit.ignores);
	const root = template.fragment(
		unit.template,
		null,
		scope,
		unit.options?.preserveWhitespace ?? false,
		namespace,
		namespace === 'html'
	);
	const classes = checkRunes(
		runes,
		[unit.module, unit.instance],
		true,
		template.placed,
		template.statements
	);
	if (unit.module !== null) scopes.resolve(unit.module, top);
	if (unit.instance !== null) scopes.resolve(unit.instance, scope);
	if (unit.module !== null) checkExports(unit.module, scopes);
	const externals = new Map<ES.Identifier, ExternalBinding>();
	for (const binding of unit.externals ?? []) {
		scopes.resolve(binding.source, scope);
		for (const reference of binding.references) {
			if (scopes.references.get(reference)?.kind === 'external') externals.set(reference, binding);
		}
	}
	return {
		unit,
		references: scopes.references,
		declarations: scopes.declarations,
		runes,
		names,
		functions: scopes.functions,
		classes,
		externals,
		lists: template.lists,
		fragments: template.fragments,
		namespaces: template.namespaces,
		fragmentNamespaces: template.fragmentNamespaces,
		ignored: template.ignored,
		separate: template.separate,
		lifted: template.lifted(scope),
		root,
		namespace: template.fragmentNamespaces.get(unit.template) ?? namespace,
		asynchronous: unit.instance !== null && hasAwait(unit.instance)
	};
}
