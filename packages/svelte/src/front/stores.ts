import type * as ES from 'estree';
import type { ExternalBinding, Rune } from 'vigla/compiler';
import type { Resolution } from './runes.ts';

function names(pattern: ES.Pattern): ES.Identifier[] {
	switch (pattern.type) {
		case 'Identifier':
			return [pattern];
		case 'ObjectPattern':
			return pattern.properties.flatMap((property) =>
				names(property.type === 'RestElement' ? property.argument : property.value)
			);
		case 'ArrayPattern':
			return pattern.elements.flatMap((element) => (element === null ? [] : names(element)));
		case 'AssignmentPattern':
			return names(pattern.left);
		case 'RestElement':
			return names(pattern.argument);
		default:
			return [];
	}
}

function declarations(program: ES.Program | null, into: Map<string, ES.Node | null>): void {
	for (const item of program?.body ?? []) {
		const statement = item.type === 'ExportNamedDeclaration' ? item.declaration : item;
		if (statement?.type === 'ImportDeclaration') {
			for (const specifier of statement.specifiers) into.set(specifier.local.name, statement);
		} else if (statement?.type === 'VariableDeclaration') {
			for (const declarator of statement.declarations) {
				for (const name of names(declarator.id)) into.set(name.name, declarator.init ?? null);
			}
		} else if (
			(statement?.type === 'FunctionDeclaration' || statement?.type === 'ClassDeclaration') &&
			statement.id !== null
		) {
			into.set(statement.id.name, statement);
		}
	}
}

interface StoreBinding extends ExternalBinding {
	readonly source: ES.Identifier;
	readonly references: Set<ES.Identifier>;
}

const runeNames = new Set([
	'$state',
	'$derived',
	'$effect',
	'$props',
	'$bindable',
	'$inspect',
	'$host'
]);

export function stores(
	resolution: Resolution,
	module: ES.Program | null,
	instance: ES.Program | null
): ExternalBinding[] {
	const moduleDeclarations = new Map<string, ES.Node | null>();
	declarations(module, moduleDeclarations);
	const declared = new Map(moduleDeclarations);
	declarations(instance, declared);
	const bindings = new Map<string, StoreBinding>();
	for (const [reference, name] of resolution.references) {
		if (name === '$' || name.startsWith('$$')) continue;
		const source = name.slice(1);
		const at = (reference as ES.Identifier & { start?: number }).start ?? -1;
		const span = module as (ES.Program & { start?: number; end?: number }) | null;
		if (span !== null && at >= (span.start ?? 0) && at < (span.end ?? 0)) continue;
		const initial = declared.get(source);
		if (runeNames.has(name)) {
			if (initial === undefined) continue;
			const rune: Rune | undefined =
				initial?.type === 'CallExpression' ? resolution.runes.get(initial.callee) : undefined;
			if (rune !== undefined && (rune !== '$props' || source === 'props')) continue;
			if (
				name === '$derived' &&
				initial?.type === 'ImportDeclaration' &&
				initial.source.value === 'svelte/store'
			)
				continue;
		}
		let binding = bindings.get(name);
		if (binding === undefined) {
			binding = {
				source: { type: 'Identifier', name: source },
				name: source,
				references: new Set()
			};
			bindings.set(name, binding);
		}
		binding.references.add(reference);
	}
	return [...bindings.values()];
}
