import type * as ES from 'estree';
import type * as IR from '../../ir/nodes.ts';

export type PathNode = ES.Node | IR.Node | IR.Attribute | IR.Fragment;

export type BindingKind =
	| 'normal'
	| 'state'
	| 'raw_state'
	| 'derived'
	| 'prop'
	| 'bindable_prop'
	| 'rest_prop'
	| 'each'
	| 'snippet'
	| 'template'
	| 'static'
	| 'store_sub';

export type DeclarationKind =
	| 'var'
	| 'let'
	| 'const'
	| 'using'
	| 'await using'
	| 'function'
	| 'import'
	| 'param'
	| 'rest_param'
	| 'synthetic';

export type Initial = ES.Node | IR.Node | null;

export interface Reference {
	readonly node: ES.Identifier;
	readonly path: readonly PathNode[];
}

export class Binding {
	readonly scope: Scope;
	readonly node: ES.Identifier;
	readonly declaration: DeclarationKind;
	kind: BindingKind;
	initial: Initial;
	readonly references: Reference[] = [];
	reassigned = false;
	mutated = false;
	insideRest = false;
	templateDeclaration = false;

	constructor(
		scope: Scope,
		node: ES.Identifier,
		kind: BindingKind,
		declaration: DeclarationKind,
		initial: Initial
	) {
		this.scope = scope;
		this.node = node;
		this.kind = kind;
		this.declaration = declaration;
		this.initial = initial;
	}

	get updated(): boolean {
		return this.mutated || this.reassigned;
	}

	isFunction(): boolean {
		if (this.updated) return false;
		const type = (this.initial as { type?: string } | null)?.type;
		return (
			type === 'ArrowFunctionExpression' ||
			type === 'FunctionExpression' ||
			type === 'FunctionDeclaration'
		);
	}
}

export type Duplicate = (node: ES.Identifier) => never;

export class Scope {
	readonly parent: Scope | null;
	readonly porous: boolean;
	readonly depth: number;
	readonly declarations = new Map<string, Binding>();
	readonly references = new Map<string, Reference[]>();
	readonly #duplicate: Duplicate;

	constructor(parent: Scope | null, porous: boolean, duplicate: Duplicate) {
		this.parent = parent;
		this.porous = porous;
		this.depth = parent === null ? 0 : parent.depth + (porous ? 0 : 1);
		this.#duplicate = duplicate;
	}

	child(porous = false): Scope {
		return new Scope(this, porous, this.#duplicate);
	}

	declare(
		node: ES.Identifier,
		kind: BindingKind,
		declaration: DeclarationKind,
		initial: Initial = null
	): Binding {
		if (this.parent !== null) {
			if (declaration === 'var' && this.porous) return this.parent.declare(node, kind, declaration);
			if (declaration === 'import') return this.parent.declare(node, kind, declaration, initial);
		}
		const existing = this.declarations.get(node.name);
		if (existing !== undefined && existing.declaration !== 'var' && declaration !== 'var') {
			this.#duplicate(node);
		}
		const binding = new Binding(this, node, kind, declaration, initial);
		this.declarations.set(node.name, binding);
		return binding;
	}

	get(name: string): Binding | null {
		for (let scope: Scope | null = this; scope !== null; scope = scope.parent) {
			const binding = scope.declarations.get(name);
			if (binding !== undefined) return binding;
		}
		return null;
	}

	owner(name: string): Scope | null {
		for (let scope: Scope | null = this; scope !== null; scope = scope.parent) {
			if (scope.declarations.has(name)) return scope;
		}
		return null;
	}

	reference(reference: Reference): void {
		const name = reference.node.name;
		for (let scope: Scope | null = this; scope !== null; scope = scope.parent) {
			let list = scope.references.get(name);
			if (list === undefined) scope.references.set(name, (list = []));
			list.push(reference);
			const binding = scope.declarations.get(name);
			if (binding !== undefined) {
				binding.references.push(reference);
				return;
			}
		}
	}
}

export function typeOf(node: PathNode): string {
	if ('type' in node) return node.type;
	if ('kind' in node) return node.kind;
	return 'fragment';
}

export function isReference(node: ES.Node, parent: ES.Node | null | undefined): boolean {
	if (node.type === 'MemberExpression') return !node.computed && isReference(node.object, node);
	if (node.type !== 'Identifier') return false;
	if (parent === null || parent === undefined) return true;
	switch (parent.type) {
		case 'MemberExpression':
			return parent.computed || node === parent.object;
		case 'MethodDefinition':
			return parent.computed;
		case 'MetaProperty':
			return parent.meta === node;
		case 'PropertyDefinition':
			return parent.computed || node === parent.value;
		case 'Property':
			return parent.computed || node === parent.value;
		case 'ExportSpecifier':
		case 'ImportSpecifier':
			return node === parent.local;
		case 'LabeledStatement':
		case 'BreakStatement':
		case 'ContinueStatement':
			return false;
		default:
			return true;
	}
}

export function identifiers(pattern: ES.Node, into: ES.Identifier[] = []): ES.Identifier[] {
	switch (pattern.type) {
		case 'Identifier':
			into.push(pattern);
			break;
		case 'ObjectPattern':
			for (const property of pattern.properties) {
				identifiers(property.type === 'RestElement' ? property : property.value, into);
			}
			break;
		case 'ArrayPattern':
			for (const element of pattern.elements) if (element !== null) identifiers(element, into);
			break;
		case 'RestElement':
			identifiers(pattern.argument, into);
			break;
		case 'AssignmentPattern':
			identifiers(pattern.left, into);
			break;
		default:
			break;
	}
	return into;
}

export function leaves(
	pattern: ES.Node,
	into: (ES.Identifier | ES.MemberExpression)[] = []
): (ES.Identifier | ES.MemberExpression)[] {
	switch (pattern.type) {
		case 'ObjectPattern':
			for (const property of pattern.properties) {
				leaves(property.type === 'RestElement' ? property : property.value, into);
			}
			break;
		case 'ArrayPattern':
			for (const element of pattern.elements) if (element !== null) leaves(element, into);
			break;
		case 'RestElement':
			leaves(pattern.argument, into);
			break;
		case 'AssignmentPattern':
			leaves(pattern.left, into);
			break;
		case 'Identifier':
		case 'MemberExpression':
			into.push(pattern);
			break;
		default:
			break;
	}
	return into;
}

export function base(expression: ES.Node): ES.Identifier | null {
	let node = expression;
	while (node.type === 'MemberExpression') node = node.object;
	return node.type === 'Identifier' ? node : null;
}
