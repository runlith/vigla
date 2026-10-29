import type * as ES from 'estree';
import { CompileError, type Rune } from 'vigla/compiler';

const known = new Set<string>([
	'$state',
	'$state.raw',
	'$state.snapshot',
	'$state.eager',
	'$derived',
	'$derived.by',
	'$effect',
	'$effect.pre',
	'$effect.root',
	'$effect.tracking',
	'$effect.pending',
	'$props',
	'$props.id',
	'$bindable',
	'$inspect',
	'$inspect.trace',
	'$host'
]);

const skipped = new Set(['type', 'loc', 'range', 'start', 'end']);

interface Scope {
	readonly parent: Scope | null;
	readonly names: ReadonlySet<string>;
}

type Callable = ES.FunctionDeclaration | ES.FunctionExpression | ES.ArrowFunctionExpression;

function children(node: ES.Node, each: (child: ES.Node) => void): void {
	for (const key of Object.keys(node)) {
		if (skipped.has(key)) continue;
		const value = (node as unknown as Record<string, unknown>)[key];
		for (const item of Array.isArray(value) ? value : [value]) {
			if (typeof item === 'object' && item !== null && typeof (item as ES.Node).type === 'string') {
				each(item as ES.Node);
			}
		}
	}
}

function patternNames(pattern: ES.Pattern, into: ES.Identifier[]): void {
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
		default:
			break;
	}
}

function isCallable(node: ES.Node): node is Callable {
	return (
		node.type === 'FunctionDeclaration' ||
		node.type === 'FunctionExpression' ||
		node.type === 'ArrowFunctionExpression'
	);
}

function declared(statement: ES.Node, into: ES.Identifier[]): void {
	switch (statement.type) {
		case 'VariableDeclaration':
			if (statement.kind !== 'var')
				for (const item of statement.declarations) patternNames(item.id, into);
			break;
		case 'FunctionDeclaration':
		case 'ClassDeclaration':
			if (statement.id) into.push(statement.id);
			break;
		case 'ImportDeclaration':
			for (const specifier of statement.specifiers) into.push(specifier.local);
			break;
		case 'ExportNamedDeclaration':
			if (statement.declaration) declared(statement.declaration, into);
			break;
		case 'ExportDefaultDeclaration': {
			const declaration = statement.declaration;
			if (
				(declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration') &&
				declaration.id
			) {
				into.push(declaration.id);
			}
			break;
		}
		default:
			break;
	}
}

function hoisted(node: ES.Node, into: ES.Identifier[]): void {
	if (node.type === 'VariableDeclaration' && node.kind === 'var') {
		for (const item of node.declarations) patternNames(item.id, into);
	}
	if (isCallable(node)) return;
	children(node, (child) => hoisted(child, into));
}

function lexical(node: ES.Node): ES.Identifier[] {
	const into: ES.Identifier[] = [];
	switch (node.type) {
		case 'Program':
		case 'BlockStatement':
		case 'StaticBlock':
			for (const statement of node.body) declared(statement, into);
			break;
		case 'ForStatement':
			if (node.init?.type === 'VariableDeclaration') declared(node.init, into);
			break;
		case 'ForInStatement':
		case 'ForOfStatement':
			declared(node.left, into);
			break;
		case 'SwitchStatement':
			for (const entry of node.cases)
				for (const statement of entry.consequent) declared(statement, into);
			break;
		case 'CatchClause':
			if (node.param !== null) patternNames(node.param, into);
			break;
		default:
			break;
	}
	return into;
}

function runeName(callee: ES.Node): { rune: Rune; base: string } | null {
	if (callee.type === 'Identifier') {
		return known.has(callee.name) ? { rune: callee.name as Rune, base: callee.name } : null;
	}
	if (
		callee.type === 'MemberExpression' &&
		!callee.computed &&
		callee.object.type === 'Identifier' &&
		callee.property.type === 'Identifier'
	) {
		const name = `${callee.object.name}.${callee.property.name}`;
		return known.has(name) ? { rune: name as Rune, base: callee.object.name } : null;
	}
	return null;
}

function shadowed(scope: Scope | null, name: string): boolean {
	for (let current = scope; current !== null; current = current.parent) {
		if (current.names.has(name)) return true;
	}
	return false;
}

function reserved(name: ES.Identifier): void {
	if (!name.name.startsWith('$')) return;
	const located = name as ES.Identifier & { start?: number; end?: number };
	const span = { start: located.start ?? 0, end: located.end ?? 0 };
	throw new CompileError(
		name.name === '$'
			? {
					code: 'dollar_binding_invalid',
					message: 'The $ name is reserved, and cannot be used for variables and imports',
					...span
				}
			: {
					code: 'dollar_prefix_invalid',
					message: 'The $ prefix is reserved, and cannot be used for variables and imports',
					...span
				}
	);
}

export class Resolution {
	readonly runes = new Map<ES.Node, Rune>();
	readonly #seen: ((node: ES.Node) => void) | undefined;

	constructor(seen?: (node: ES.Node) => void) {
		this.#seen = seen;
	}

	program(program: ES.Program): void {
		this.visit(program, null, false);
	}

	expression(node: ES.Node): void {
		this.visit(node, null, true);
	}

	private scope(parent: Scope | null, names: readonly ES.Identifier[], nested: boolean): Scope {
		if (!nested) for (const name of names) reserved(name);
		return { parent, names: new Set(names.map((name) => name.name)) };
	}

	private visit(node: ES.Node, scope: Scope | null, nested: boolean): void {
		this.#seen?.(node);
		if (node.type === 'CallExpression') {
			const found = runeName(node.callee);
			if (found !== null && !shadowed(scope, found.base)) this.runes.set(node.callee, found.rune);
		}
		if (isCallable(node)) {
			const names: ES.Identifier[] = [];
			if (node.type === 'FunctionExpression' && node.id) names.push(node.id);
			for (const param of node.params) patternNames(param, names);
			if (node.body.type === 'BlockStatement') {
				hoisted(node.body, names);
				names.push(...lexical(node.body));
			}
			const inner = this.scope(scope, names, true);
			for (const param of node.params) this.visit(param, inner, true);
			if (node.body.type === 'BlockStatement') {
				for (const statement of node.body.body) this.visit(statement, inner, true);
			} else {
				this.visit(node.body, inner, true);
			}
			return;
		}
		let inner = scope;
		switch (node.type) {
			case 'Program': {
				const names = lexical(node);
				hoisted(node, names);
				inner = this.scope(scope, names, nested);
				break;
			}
			case 'BlockStatement':
			case 'StaticBlock':
			case 'ForStatement':
			case 'ForInStatement':
			case 'ForOfStatement':
			case 'SwitchStatement':
			case 'CatchClause':
				inner = this.scope(scope, lexical(node), nested);
				break;
			default:
				break;
		}
		children(node, (child) => this.visit(child, inner, nested));
	}
}
