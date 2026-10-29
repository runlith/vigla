import type * as ES from 'estree';
import type * as IR from '../../ir/nodes.ts';
import type { ComponentUnit, Diagnostic, ModuleUnit } from '../../ir/port.ts';
import { Context, type Settings } from './context.ts';
import { Order, type Phased } from './order.ts';
import { fail, Report } from './report.ts';
import { typeOf, type Reference, type Scope } from './scope.ts';
import { runeOf, Scopes } from './scopes.ts';
import { runeNames, visit } from './script.ts';
import { Template } from './template.ts';

export interface ValidateOptions {
	readonly customElement?: boolean;
	readonly async?: boolean;
	readonly namespace?: IR.Namespace;
	readonly warnings?: Phased;
}

const reserved = new Set(['$$props', '$$restProps', '$$slots']);

const duplicate = (node: ES.Identifier): never =>
	fail('declaration_duplicate', node, { name: node.name });

function invalidGlobal(name: string, references: readonly Reference[]): void {
	if (name === '$' || name[1] === '$')
		fail('global_reference_invalid', references[0]!.node, { name });
}

function nested(
	scopes: Scopes,
	references: readonly Reference[],
	store: string,
	roots: readonly Scope[]
): ES.Identifier | null {
	for (const reference of references) {
		for (let index = reference.path.length - 1; index >= 0; index--) {
			const scope = scopes.map.get(reference.path[index]!);
			if (scope === undefined) continue;
			const owner = scope.owner(store);
			if (owner !== null && !roots.includes(owner)) return reference.node;
			break;
		}
	}
	return null;
}

function stores(context: Context, unit: ComponentUnit, instance: Scope): void {
	const module = context.module;
	const runes = context.runes;
	for (const [name, references] of [...module.references]) {
		if (name[0] !== '$' || reserved.has(name)) continue;
		invalidGlobal(name, references);
		const store = name.slice(1);
		const declaration = instance.get(store);
		const initial = declaration?.initial as ES.Node | null | undefined;
		const kind = declaration?.kind;
		const rune =
			kind === 'prop' || kind === 'rest_prop' || kind === 'bindable_prop'
				? '$props'
				: runeOf(runes, initial);
		const subscribes =
			!runeNames.has(name) ||
			(declaration !== null &&
				(rune === null || (store !== 'props' && rune === '$props')) &&
				!(
					name === '$derived' &&
					initial?.type === 'ImportDeclaration' &&
					initial.source.value === 'svelte/store'
				));
		if (!subscribes) continue;
		const inner = nested(context.scopes, references, store, [module, instance]);
		if (inner !== null) fail('store_invalid_scoped_subscription', inner);
		if (declaration === null && /[a-z]/.test(store[0] ?? '')) {
			fail('global_reference_invalid', references[0]!.node, { name });
		} else if (declaration !== null && runeNames.has(name)) {
			for (const { node, path } of references) {
				if ((path.at(-1) as ES.Node | undefined)?.type === 'CallExpression')
					context.report.warn('store_rune_conflict', node, { name: store });
			}
		}
		if (unit.module !== null) {
			const span = unit.module as { start?: number; end?: number };
			for (const { node, path } of references) {
				const at = node as { start?: number; end?: number };
				if (
					(at.start ?? 0) > (span.start ?? 0) &&
					(at.end ?? 0) < (span.end ?? 0) &&
					runeOf(runes, path.at(-1) as ES.Node) === null
				) {
					fail('store_invalid_subscription', node);
				}
			}
		}
		const binding = instance.declare({ type: 'Identifier', name }, 'store_sub', 'synthetic');
		binding.references.push(...references);
		instance.references.set(name, references);
		module.references.delete(name);
	}
}

function nonReactive(context: Context, scopes: readonly Scope[]): void {
	for (const scope of scopes) {
		outer: for (const [name, binding] of scope.declarations) {
			if (binding.kind !== 'normal' || !binding.reassigned) continue;
			inner: for (const { path } of binding.references) {
				if (path.length === 0 || typeOf(path[0]!) !== 'fragment') continue;
				for (let index = 1; index < path.length; index++) {
					const node = path[index]!;
					const type = typeOf(node);
					if (
						type === 'FunctionDeclaration' ||
						type === 'FunctionExpression' ||
						type === 'ArrowFunctionExpression'
					) {
						continue inner;
					}
					if (type === 'binding' && (node as IR.Binding).name === 'this') {
						for (let before = index - 1; before >= 0; before--) {
							const kind = typeOf(path[before]!);
							if (
								kind === 'branch' ||
								kind === 'keyed-list' ||
								kind === 'unkeyed-list' ||
								kind === 'async-block' ||
								kind === 'keyed-block'
							) {
								context.report.warn('non_reactive_update', binding.node, { name });
								continue outer;
							}
						}
						continue inner;
					}
				}
				context.report.warn('non_reactive_update', binding.node, { name });
				continue outer;
			}
		}
	}
}

function hoistable(context: Context, scope: Scope, visited: Set<object>): boolean {
	for (const name of scope.references.keys()) {
		const binding = scope.get(name);
		if (binding === null) continue;
		if (binding.scope.depth === 0 || binding.scope.depth >= scope.depth) continue;
		const initial = binding.initial as IR.Node | null;
		if (initial !== null && 'kind' in initial && initial.kind === 'snippet') {
			if (visited.has(binding)) continue;
			visited.add(binding);
			const inner = context.scopes.map.get(initial);
			if (inner !== undefined && hoistable(context, inner, visited)) continue;
		}
		return false;
	}
	return true;
}

function exports(context: Context, program: ES.Program, unit: ComponentUnit): void {
	const module = context.module;
	const hoisted = new Set<string>();
	for (const snippet of context.snippets) {
		if (!unit.template.nodes.includes(snippet)) continue;
		const scope = context.scopes.map.get(snippet);
		if (scope !== undefined && hoistable(context, scope, new Set())) hoisted.add(snippet.name.name);
	}
	for (const node of program.body) {
		if (node.type !== 'ExportNamedDeclaration' || node.source != null) continue;
		for (const specifier of node.specifiers) {
			if (specifier.local.type !== 'Identifier') continue;
			const name = specifier.local.name;
			if (module.get(name) !== null || hoisted.has(name)) continue;
			if (context.snippets.some((snippet) => snippet.name.name === name))
				fail('snippet_invalid_export', specifier);
			fail('export_undefined', specifier, { name });
		}
	}
}

export function validateComponent(
	unit: ComponentUnit,
	options: ValidateOptions = {}
): Diagnostic[] {
	const report = new Report(unit.ignores);
	const scopes = new Scopes(unit.runes, duplicate);
	const module = scopes.root(null);
	if (unit.module !== null) scopes.program(unit.module, module);
	const instance = scopes.root(module);
	if (unit.instance !== null) scopes.program(unit.instance, instance);
	const root = scopes.root(instance);
	scopes.fragment(unit.template, root, false);
	scopes.finish();
	const customElement =
		(options.customElement ?? false) || (unit.options?.customElement ?? null) !== null;
	const settings: Settings = {
		customElement,
		customProps: (unit.options?.customElement?.props ?? null) !== null,
		async: options.async ?? true
	};
	const context = new Context(unit, report, scopes, settings, module, instance, visit);
	const order = new Order(report.warnings);
	stores(context, unit, instance);
	const program = unit.module;
	if (program !== null) {
		order.phase('module', () => {
			context.start('module', module);
			context.es(program);
		});
	}
	const script = unit.instance;
	if (script !== null) {
		order.phase('instance', () => {
			context.start('instance', instance);
			context.es(script);
		});
	}
	order.phase('template', () => {
		context.start('template', root);
		new Template(context, unit.options?.namespace ?? options.namespace ?? 'html').fragment(
			unit.template
		);
	});
	nonReactive(context, [module, instance]);
	if (program !== null) exports(context, program, unit);
	return order.result(options.warnings ?? {});
}

export function validateModule(unit: ModuleUnit, options: ValidateOptions = {}): Diagnostic[] {
	const report = new Report(unit.ignores);
	const scopes = new Scopes(unit.runes, duplicate);
	const scope = scopes.root(null);
	scopes.program(unit.program, scope);
	scopes.finish();
	const settings: Settings = {
		customElement: false,
		customProps: false,
		async: options.async ?? true
	};
	const context = new Context(unit, report, scopes, settings, scope, null, visit);
	for (const [name, references] of scope.references) {
		if (name[0] !== '$' || reserved.has(name)) continue;
		invalidGlobal(name, references);
		if (scope.get(name.slice(1)) !== null && !runeNames.has(name)) {
			fail('store_invalid_subscription_module', references[0]!.node);
		}
	}
	const order = new Order(report.warnings);
	order.phase('module', () => {
		context.start(null, scope);
		context.es(unit.program);
	});
	return order.result(options.warnings ?? {});
}
