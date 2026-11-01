import type * as ES from 'estree';
import { children } from '../ir/estree.ts';
import type { Span } from '../ir/nodes.ts';
import { CompileError, type Rune, type Runes } from '../ir/port.ts';

export type BindingKind =
	| 'normal'
	| 'state'
	| 'raw-state'
	| 'derived'
	| 'prop'
	| 'rest-prop'
	| 'slot-info'
	| 'item'
	| 'index'
	| 'snippet'
	| 'argument'
	| 'external'
	| 'import'
	| 'template-constant';

export interface Prop {
	readonly key: string;
	readonly fallback: ES.Expression | null;
	readonly bindable: boolean;
}

export interface Binding {
	readonly name: string;
	readonly kind: BindingKind;
	readonly rune: Rune | null;
	readonly declaration: ES.Identifier | null;
	readonly initial: ES.Node | null;
	readonly prop: Prop | null;
	readonly constant: boolean;
	reassigned: boolean;
	mutated: boolean;
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

export function spanOf(node: ES.Node): Span {
	const located = node as ES.Node & Partial<Span>;
	return { start: located.start ?? 0, end: located.end ?? 0 };
}

export function unsupported(span: Span, what: string): CompileError {
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
			return parent.computed && parent.key === node;
		case 'PropertyDefinition':
			return parent.value === node || (parent.computed && parent.key === node);
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

function functional(node: ES.Node | null | undefined): boolean {
	return node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression';
}

function literal(node: ES.Node | null | undefined): boolean {
	return node?.type === 'Literal' && !('regex' in node);
}

export interface Declared {
	readonly kind: BindingKind;
	readonly rune?: Rune | null;
	readonly initial?: ES.Node | null;
	readonly prop?: Prop | null;
	readonly constant?: boolean;
}

export class Scopes {
	readonly runes: Runes;
	readonly owned = new Map<ES.Node, Scope>();
	readonly references = new Map<ES.Identifier, Binding>();
	readonly declarations = new Map<ES.Identifier, Binding>();
	readonly functions = new Set<Binding>();

	constructor(runes: Runes) {
		this.runes = runes;
	}

	root(parent: Scope | null): Scope {
		return new Scope(parent, true);
	}

	child(parent: Scope): Scope {
		return new Scope(parent, false);
	}

	bind(scope: Scope, name: ES.Identifier, declared: Declared): Binding {
		const binding: Binding = {
			name: name.name,
			kind: declared.kind,
			rune: declared.rune ?? null,
			declaration: name,
			initial: declared.initial ?? null,
			prop: declared.prop ?? null,
			constant: declared.constant ?? false,
			reassigned: false,
			mutated: false
		};
		scope.bindings.set(name.name, binding);
		this.declarations.set(name, binding);
		return binding;
	}

	rune(node: ES.Node | null | undefined): Rune | null {
		return node?.type === 'CallExpression' ? (this.runes.get(node.callee) ?? null) : null;
	}

	private props(pattern: ES.Pattern, scope: Scope): void {
		if (pattern.type === 'Identifier') {
			this.bind(scope, pattern, { kind: 'rest-prop' });
			return;
		}
		if (pattern.type !== 'ObjectPattern') {
			throw unsupported(spanOf(pattern), 'This $props() pattern');
		}
		for (const property of pattern.properties) {
			if (property.type === 'RestElement') {
				if (property.argument.type !== 'Identifier')
					throw unsupported(spanOf(property), 'This $props() rest pattern');
				this.bind(scope, property.argument, { kind: 'rest-prop' });
				continue;
			}
			if (
				property.computed ||
				(property.key.type !== 'Identifier' && property.key.type !== 'Literal')
			) {
				throw unsupported(spanOf(property), 'A computed $props() key');
			}
			const key =
				property.key.type === 'Identifier' ? property.key.name : String(property.key.value);
			let value = property.value;
			let fallback: ES.Expression | null = null;
			if (value.type === 'AssignmentPattern') {
				fallback = value.right;
				value = value.left;
			}
			let bindable = false;
			if (fallback !== null && this.rune(fallback) === '$bindable') {
				bindable = true;
				const call = fallback as ES.CallExpression;
				fallback = (call.arguments[0] as ES.Expression | undefined) ?? null;
			}
			if (value.type !== 'Identifier') {
				throw unsupported(spanOf(value), 'A destructured $props() property');
			}
			this.bind(scope, value, { kind: 'prop', prop: { key, fallback, bindable } });
		}
	}

	declare(node: ES.Node, scope: Scope): void {
		let inner = this.owned.get(node) ?? scope;
		switch (node.type) {
			case 'ImportDeclaration':
				for (const specifier of node.specifiers)
					this.bind(scope, specifier.local, { kind: 'import' });
				return;
			case 'FunctionDeclaration':
			case 'FunctionExpression':
			case 'ArrowFunctionExpression':
				if (node.type === 'FunctionDeclaration' && node.id) {
					this.functions.add(this.bind(scope, node.id, { kind: 'normal', initial: node }));
				}
				inner = new Scope(scope, true);
				if (node.type === 'FunctionExpression' && node.id) {
					this.bind(inner, node.id, { kind: 'normal', initial: node });
				}
				for (const param of node.params) this.pattern(param, inner, { kind: 'normal' });
				this.owned.set(node, inner);
				if (node.body.type === 'BlockStatement') this.owned.set(node.body, new Scope(inner, true));
				break;
			case 'ClassDeclaration':
				if (node.id !== null) this.bind(scope, node.id, { kind: 'normal' });
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
				if (node.param !== null) this.pattern(node.param, inner, { kind: 'normal' });
				this.owned.set(node, inner);
				this.owned.set(node.body, inner);
				break;
			case 'VariableDeclaration': {
				const target = node.kind === 'var' ? scope.closestFunction() : scope;
				for (const declarator of node.declarations) {
					const init = declarator.init;
					const rune = this.rune(init);
					if (rune === '$props') {
						this.props(declarator.id, target);
						continue;
					}
					const kind = kindOf(rune);
					if (rune === '$props.id' && declarator.id.type !== 'Identifier') {
						throw unsupported(spanOf(declarator.id), `Destructuring a ${rune} declaration`);
					}
					const binding = {
						kind,
						rune,
						initial: init ?? null,
						constant: kind === 'normal' && node.kind === 'const' && literal(init)
					};
					for (const name of patternNames(declarator.id)) {
						const bound = this.bind(target, name, binding);
						if (kind === 'normal' && declarator.id.type === 'Identifier' && functional(init)) {
							if (node.kind === 'const') this.functions.add(bound);
						}
					}
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
		if (node.type === 'AssignmentExpression') this.written(node.left, inner);
		if (node.type === 'UpdateExpression') this.written(node.argument as ES.Pattern, inner);
		if (
			(node.type === 'ForInStatement' || node.type === 'ForOfStatement') &&
			node.left.type !== 'VariableDeclaration'
		) {
			this.written(node.left, inner);
		}
		children(node, (child) => this.resolve(child, inner, node));
	}

	bound(expression: ES.Expression, scope: Scope): void {
		if (expression.type === 'SequenceExpression') return;
		this.written(expression as ES.Pattern, scope);
	}

	private written(target: ES.Pattern, scope: Scope): void {
		if (target.type === 'MemberExpression') {
			let object: ES.Node = target;
			while (object.type === 'MemberExpression') object = object.object;
			if (object.type === 'Identifier') {
				const binding = scope.lookup(object.name);
				if (binding !== null) binding.mutated = true;
			}
			return;
		}
		for (const name of patternNames(target)) {
			const binding = scope.lookup(name.name);
			if (binding === null) continue;
			binding.reassigned = true;
			this.references.set(name, binding);
			this.functions.delete(binding);
		}
		walkMembers(target, (object) => {
			const binding = scope.lookup(object.name);
			if (binding !== null) binding.mutated = true;
		});
	}

	private pattern(pattern: ES.Pattern, scope: Scope, declared: Declared): void {
		for (const name of patternNames(pattern)) this.bind(scope, name, declared);
	}
}

function walkMembers(pattern: ES.Pattern, each: (object: ES.Identifier) => void): void {
	switch (pattern.type) {
		case 'MemberExpression': {
			let object: ES.Node = pattern;
			while (object.type === 'MemberExpression') object = object.object;
			if (object.type === 'Identifier') each(object);
			break;
		}
		case 'ObjectPattern':
			for (const property of pattern.properties)
				walkMembers(property.type === 'RestElement' ? property.argument : property.value, each);
			break;
		case 'ArrayPattern':
			for (const element of pattern.elements) if (element !== null) walkMembers(element, each);
			break;
		case 'RestElement':
			walkMembers(pattern.argument, each);
			break;
		case 'AssignmentPattern':
			walkMembers(pattern.left, each);
			break;
		default:
			break;
	}
}
