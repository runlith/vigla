import type * as ES from 'estree';
import { children } from '../ir/estree.ts';
import { CompileError, type Rune, type Runes } from '../ir/port.ts';

export type BindingKind = 'normal' | 'state' | 'raw-state' | 'derived' | 'item' | 'import';

export interface Binding {
	readonly name: string;
	readonly kind: BindingKind;
	readonly rune: Rune | null;
	readonly declaration: ES.Identifier | null;
	reassigned: boolean;
}

export class Scope {
	readonly parent: Scope | null;
	readonly function: boolean;
	readonly bindings = new Map<string, Binding>();

	constructor(parent: Scope | null, isFunction: boolean) {
		this.parent = parent;
		this.function = isFunction;
	}

	lookup(name: string): Binding | null {
		for (let scope: Scope | null = this; scope !== null; scope = scope.parent) {
			const found = scope.bindings.get(name);
			if (found !== undefined) return found;
		}
		return null;
	}

	closestFunction(): Scope {
		let scope: Scope = this;
		while (!scope.function && scope.parent !== null) scope = scope.parent;
		return scope;
	}
}

export function spanOf(node: ES.Node): { start: number; end: number } {
	const located = node as ES.Node & { start?: number; end?: number };
	return { start: located.start ?? 0, end: located.end ?? 0 };
}

export function unsupported(span: { start: number; end: number }, what: string): CompileError {
	return new CompileError({
		code: 'unsupported',
		message: `${what} is not supported yet`,
		start: span.start,
		end: span.end
	});
}

export function patternNames(pattern: ES.Pattern, into: ES.Identifier[] = []): ES.Identifier[] {
	switch (pattern.type) {
		case 'Identifier':
			into.push(pattern);
			break;
		case 'ObjectPattern':
			for (const property of pattern.properties)
				patternNames(property.type === 'RestElement' ? property.argument : property.value, into);
			break;
		case 'ArrayPattern':
			for (const element of pattern.elements) if (element !== null) patternNames(element, into);
			break;
		case 'RestElement':
			patternNames(pattern.argument, into);
			break;
		case 'AssignmentPattern':
			patternNames(pattern.left, into);
			break;
		case 'MemberExpression':
			break;
	}
	return into;
}

function kindOf(rune: Rune | null): BindingKind {
	switch (rune) {
		case '$state':
			return 'state';
		case '$state.raw':
			return 'raw-state';
		case '$derived':
		case '$derived.by':
			return 'derived';
		default:
			return 'normal';
	}
}

function isReference(node: ES.Identifier, parent: ES.Node | null): boolean {
	if (parent === null) return true;
	switch (parent.type) {
		case 'MemberExpression':
			return parent.object === node || parent.computed;
		case 'MethodDefinition':
		case 'PropertyDefinition':
			return parent.computed && parent.key === node;
		case 'Property':
			return parent.computed ? true : parent.value === node;
		case 'ExportSpecifier':
			return parent.local === node;
		case 'ImportSpecifier':
		case 'ImportDefaultSpecifier':
		case 'ImportNamespaceSpecifier':
		case 'LabeledStatement':
		case 'BreakStatement':
		case 'ContinueStatement':
		case 'MetaProperty':
			return false;
		case 'VariableDeclarator':
			return parent.init === node;
		case 'FunctionDeclaration':
		case 'FunctionExpression':
			return parent.id !== node && !parent.params.includes(node);
		case 'ArrowFunctionExpression':
			return !parent.params.includes(node);
		case 'ClassDeclaration':
		case 'ClassExpression':
			return parent.id !== node;
		case 'CatchClause':
			return parent.param !== node;
		case 'AssignmentPattern':
			return parent.right === node;
		case 'RestElement':
		case 'ArrayPattern':
			return false;
		default:
			return true;
	}
}

export class Scopes {
	readonly runes: Runes;
	readonly owned = new Map<ES.Node, Scope>();
	readonly references = new Map<ES.Identifier, Binding>();
	readonly declarations = new Map<ES.Identifier, Binding>();

	constructor(runes: Runes) {
		this.runes = runes;
	}

	root(parent: Scope | null): Scope {
		return new Scope(parent, true);
	}

	child(parent: Scope): Scope {
		return new Scope(parent, false);
	}

	bind(scope: Scope, name: ES.Identifier, kind: BindingKind, rune: Rune | null = null): Binding {
		const binding: Binding = { name: name.name, kind, rune, declaration: name, reassigned: false };
		scope.bindings.set(name.name, binding);
		this.declarations.set(name, binding);
		return binding;
	}

	declare(node: ES.Node, scope: Scope): void {
		let inner = this.owned.get(node) ?? scope;
		switch (node.type) {
			case 'ImportDeclaration':
				for (const specifier of node.specifiers) this.bind(scope, specifier.local, 'import');
				return;
			case 'FunctionDeclaration':
			case 'FunctionExpression':
			case 'ArrowFunctionExpression':
				if (node.type === 'FunctionDeclaration' && node.id) this.bind(scope, node.id, 'normal');
				inner = new Scope(scope, true);
				if (node.type === 'FunctionExpression' && node.id) this.bind(inner, node.id, 'normal');
				for (const param of node.params) this.pattern(param, inner, 'normal', null);
				this.owned.set(node, inner);
				if (node.body.type === 'BlockStatement') this.owned.set(node.body, inner);
				break;
			case 'ClassDeclaration':
				if (node.id !== null) this.bind(scope, node.id, 'normal');
				break;
			case 'BlockStatement':
			case 'ForStatement':
			case 'ForInStatement':
			case 'ForOfStatement':
			case 'SwitchStatement':
				if (!this.owned.has(node)) {
					inner = new Scope(scope, false);
					this.owned.set(node, inner);
				}
				break;
			case 'CatchClause':
				inner = new Scope(scope, false);
				if (node.param !== null) this.pattern(node.param, inner, 'normal', null);
				this.owned.set(node, inner);
				this.owned.set(node.body, inner);
				break;
			case 'VariableDeclaration': {
				const target = node.kind === 'var' ? scope.closestFunction() : scope;
				for (const declarator of node.declarations) {
					const init = declarator.init;
					const rune =
						init?.type === 'CallExpression' ? (this.runes.get(init.callee) ?? null) : null;
					const kind = kindOf(rune);
					if (kind !== 'normal' && declarator.id.type !== 'Identifier') {
						throw unsupported(spanOf(declarator.id), `Destructuring a ${rune ?? ''} declaration`);
					}
					this.pattern(declarator.id, target, kind, rune);
				}
				break;
			}
		}
		children(node, (child) => this.declare(child, inner));
	}

	resolve(node: ES.Node, scope: Scope, parent: ES.Node | null = null): void {
		const inner = this.owned.get(node) ?? scope;
		if (node.type === 'Identifier') {
			if (!isReference(node, parent)) return;
			const binding = inner.lookup(node.name);
			if (binding !== null) this.references.set(node, binding);
			return;
		}
		if (node.type === 'AssignmentExpression' || node.type === 'UpdateExpression') {
			const target = node.type === 'AssignmentExpression' ? node.left : node.argument;
			const names = target.type === 'Identifier' ? [target] : patternNames(target as ES.Pattern);
			for (const name of names) {
				const binding = inner.lookup(name.name);
				if (binding !== null) binding.reassigned = true;
			}
		}
		children(node, (child) => this.resolve(child, inner, node));
	}

	private pattern(pattern: ES.Pattern, scope: Scope, kind: BindingKind, rune: Rune | null): void {
		for (const name of patternNames(pattern)) this.bind(scope, name, kind, rune);
	}
}
