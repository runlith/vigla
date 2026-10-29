import type * as ES from 'estree';
import { children } from '../../ir/estree.ts';
import type * as IR from '../../ir/nodes.ts';
import type { Runes } from '../../ir/port.ts';
import {
	base,
	identifiers,
	isReference,
	leaves,
	Scope,
	type Binding,
	type Duplicate,
	type PathNode,
	type Reference
} from './scope.ts';

type Callable = ES.FunctionDeclaration | ES.FunctionExpression | ES.ArrowFunctionExpression;

function isCallable(node: ES.Node | PathNode | undefined): node is Callable {
	const type = (node as { type?: string } | undefined)?.type;
	return (
		type === 'FunctionDeclaration' ||
		type === 'FunctionExpression' ||
		type === 'ArrowFunctionExpression'
	);
}

export function runeOf(runes: Runes, node: ES.Node | null | undefined): string | null {
	if (node?.type !== 'CallExpression') return null;
	return runes.get(node.callee) ?? null;
}

function settleProps(pattern: ES.Pattern, scope: Scope, runes: Runes): void {
	if (pattern.type === 'Identifier') {
		const binding = scope.get(pattern.name);
		if (binding !== null) {
			binding.initial = null;
			binding.kind = 'rest_prop';
		}
		return;
	}
	if (pattern.type !== 'ObjectPattern') return;
	for (const property of pattern.properties) {
		if (property.type === 'RestElement') {
			for (const id of identifiers(property)) {
				const binding = scope.get(id.name);
				if (binding !== null) binding.kind = 'rest_prop';
			}
			continue;
		}
		const value =
			property.value.type === 'AssignmentPattern' ? property.value.left : property.value;
		if (value.type !== 'Identifier') continue;
		const binding = scope.get(value.name);
		if (binding === null) continue;
		const initial = property.value.type === 'AssignmentPattern' ? property.value.right : null;
		if (initial?.type === 'CallExpression' && runes.get(initial.callee) === '$bindable') {
			binding.initial = (initial.arguments[0] as ES.Expression | undefined) ?? null;
			binding.kind = 'bindable_prop';
		} else {
			binding.initial = initial;
		}
	}
}

export function settle(
	declarator: ES.VariableDeclarator,
	scope: Scope,
	runes: Runes,
	rune: string | null
): void {
	const kind =
		rune === '$state'
			? 'state'
			: rune === '$state.raw'
				? 'raw_state'
				: rune === '$derived' || rune === '$derived.by'
					? 'derived'
					: rune === '$props'
						? 'prop'
						: null;
	if (kind === null) return;
	for (const id of identifiers(declarator.id)) {
		const binding = scope.get(id.name);
		if (binding !== null) binding.kind = kind;
	}
	if (rune === '$props') settleProps(declarator.id, scope, runes);
}

export class Scopes {
	readonly map = new Map<object, Scope>();
	readonly runes: Runes;
	readonly path: PathNode[] = [];
	readonly #references: [Scope, Reference][] = [];
	readonly #updates: [Scope, ES.Node][] = [];
	readonly #duplicate: Duplicate;

	constructor(runes: Runes, duplicate: Duplicate) {
		this.runes = runes;
		this.#duplicate = duplicate;
	}

	root(parent: Scope | null): Scope {
		return parent === null ? new Scope(null, false, this.#duplicate) : parent.child();
	}

	program(program: ES.Program, scope: Scope): void {
		this.map.set(program, scope);
		this.es(program, scope);
	}

	#params(scope: Scope, params: readonly ES.Pattern[]): void {
		for (const param of params) {
			for (const id of identifiers(param)) {
				scope.declare(id, 'normal', param.type === 'RestElement' ? 'rest_param' : 'param');
			}
		}
	}

	#children(node: ES.Node, scope: Scope): void {
		this.path.push(node);
		children(node, (child) => this.es(child, scope));
		this.path.pop();
	}

	#scoped(node: ES.Node, scope: Scope): void {
		this.map.set(node, scope);
		this.#children(node, scope);
	}

	declarator(
		declarator: ES.VariableDeclarator,
		scope: Scope,
		kind: ES.VariableDeclaration['kind'],
		template: boolean
	): void {
		for (const id of identifiers(declarator.id)) {
			const binding = scope.declare(
				id,
				template ? 'template' : 'normal',
				kind,
				declarator.init ?? null
			);
			binding.templateDeclaration = true;
		}
	}

	es(node: ES.Node, scope: Scope): void {
		switch (node.type) {
			case 'Identifier': {
				const parent = this.path.at(-1);
				if (parent !== undefined && isReference(node, parent as ES.Node)) {
					this.#references.push([scope, { node, path: this.path.slice() }]);
				}
				return;
			}
			case 'AssignmentExpression':
				this.#updates.push([scope, node.left]);
				break;
			case 'UpdateExpression':
				this.#updates.push([scope, node.argument]);
				break;
			case 'ImportDeclaration':
				for (const specifier of node.specifiers)
					scope.declare(specifier.local, 'normal', 'import', node);
				return;
			case 'FunctionExpression': {
				const inner = scope.child(true);
				if (node.id) inner.declare(node.id, 'normal', 'function');
				this.#params(inner, node.params);
				this.#scoped(node, inner);
				return;
			}
			case 'FunctionDeclaration': {
				if (node.id) scope.declare(node.id, 'normal', 'function', node);
				const inner = scope.child(true);
				this.#params(inner, node.params);
				this.#scoped(node, inner);
				return;
			}
			case 'ArrowFunctionExpression': {
				const inner = scope.child(true);
				this.#params(inner, node.params);
				this.#scoped(node, inner);
				return;
			}
			case 'ForStatement':
			case 'ForInStatement':
			case 'ForOfStatement':
			case 'SwitchStatement':
				this.#scoped(node, scope.child(true));
				return;
			case 'BlockStatement':
				this.#scoped(node, scope.child(!isCallable(this.path.at(-1))));
				return;
			case 'ClassDeclaration':
				if (node.id) scope.declare(node.id, 'normal', 'let', node);
				break;
			case 'VariableDeclaration':
				for (const declarator of node.declarations)
					this.declarator(declarator, scope, node.kind, false);
				break;
			case 'CatchClause':
				if (node.param) {
					const inner = scope.child(true);
					for (const id of identifiers(node.param)) inner.declare(id, 'normal', 'let');
					this.#scoped(node, inner);
					return;
				}
				break;
			default:
				break;
		}
		this.#children(node, scope);
	}

	#within(node: PathNode, run: () => void): void {
		this.path.push(node);
		run();
		this.path.pop();
	}

	expression(node: ES.Node, scope: Scope): void {
		this.es(node, scope);
	}

	fragment(fragment: IR.Fragment, scope: Scope, transparent: boolean): Scope {
		const inner = scope.child(transparent);
		this.map.set(fragment, inner);
		this.#nodes(fragment, inner);
		return inner;
	}

	#nodes(fragment: IR.Fragment, scope: Scope): void {
		this.#within(fragment, () => {
			for (const node of fragment.nodes) this.node(node, scope);
		});
	}

	#value(value: IR.Value, scope: Scope): void {
		if (value.kind === 'expression') this.expression(value.expression, scope);
		else if (value.kind === 'text') {
			for (const part of value.parts) {
				if (part.kind === 'expression')
					this.#within(part, () => this.expression(part.expression, scope));
			}
		}
	}

	attribute(attribute: IR.Attribute, scope: Scope): void {
		this.#within(attribute, () => {
			switch (attribute.kind) {
				case 'attribute':
				case 'style':
					this.#value(attribute.value, scope);
					return;
				case 'spread':
				case 'class':
				case 'attachment':
					this.expression(attribute.expression, scope);
					return;
				case 'binding':
					if (attribute.expression.type !== 'SequenceExpression') {
						this.#updates.push([scope, attribute.expression]);
					}
					this.expression(attribute.expression, scope);
					return;
				case 'action':
					this.expression(attribute.action, scope);
					if (attribute.argument) this.expression(attribute.argument, scope);
					return;
				case 'transition':
					this.expression(attribute.transition, scope);
					if (attribute.argument) this.expression(attribute.argument, scope);
					return;
				case 'animation':
					this.expression(attribute.animation, scope);
					if (attribute.argument) this.expression(attribute.argument, scope);
					return;
			}
		});
	}

	#list(node: IR.KeyedList | IR.UnkeyedList, scope: Scope): void {
		this.expression(node.collection, scope);
		if (node.fallback) this.fragment(node.fallback, scope, false);
		const inner = scope.child();
		this.map.set(node, inner);
		this.map.set(node.body, inner);
		if (node.item) {
			const rest = new Set<ES.Identifier>();
			collectRest(node.item, false, rest);
			for (const id of identifiers(node.item)) {
				const binding = inner.declare(id, 'each', 'const');
				binding.insideRest = rest.has(id);
			}
			this.expression(node.item, inner);
		}
		if (node.index) {
			const keyed =
				node.kind === 'keyed-list' &&
				(node.key.type !== 'Identifier' || node.key.name !== node.index.name);
			inner.declare(
				{ type: 'Identifier', name: node.index.name },
				keyed ? 'template' : 'static',
				'const',
				node
			);
		}
		if (node.kind === 'keyed-list') this.expression(node.key, inner);
		this.#nodes(node.body, inner);
	}

	#outcome(outcome: IR.Outcome, scope: Scope): void {
		const body = this.fragment(outcome.body, scope, false);
		if (outcome.binding === null) return;
		const value = scope.child();
		this.map.set(outcome.binding, value);
		this.expression(outcome.binding, value);
		for (const id of identifiers(outcome.binding)) {
			body.declare(id, 'template', 'const');
			value.declare(id, 'normal', 'const');
		}
	}

	#snippet(node: IR.Snippet, scope: Scope): void {
		scope.declare(node.name, 'normal', 'function', node);
		const inner = scope.child();
		this.map.set(node, inner);
		for (const parameter of node.parameters) {
			for (const id of identifiers(parameter)) inner.declare(id, 'snippet', 'let');
		}
		this.expression(node.name, inner);
		for (const parameter of node.parameters) this.expression(parameter, inner);
		const body = this.fragment(node.body, inner, false);
		for (const [name, binding] of body.declarations) {
			if (inner.declarations.has(name)) this.#duplicate(binding.node);
		}
	}

	node(node: IR.Node, scope: Scope): void {
		this.#within(node, () => {
			switch (node.kind) {
				case 'text':
				case 'comment':
					return;
				case 'expression':
				case 'raw-html':
					this.expression(node.expression, scope);
					return;
				case 'element':
				case 'special':
				case 'boundary':
					for (const attribute of node.attributes) this.attribute(attribute, scope);
					this.fragment(node.body, scope, true);
					return;
				case 'dynamic-element':
					this.expression(node.tag, scope);
					for (const attribute of node.attributes) this.attribute(attribute, scope);
					this.fragment(node.body, scope, true);
					return;
				case 'slot':
					for (const attribute of node.attributes) this.attribute(attribute, scope);
					this.fragment(node.fallback, scope, true);
					return;
				case 'component': {
					for (const attribute of node.attributes) this.attribute(attribute, scope);
					const inner = scope.child();
					this.map.set(node.body, inner);
					this.#nodes(node.body, inner);
					return;
				}
				case 'branch':
					for (const arm of node.arms) {
						this.expression(arm.test, scope);
						this.fragment(arm.body, scope, false);
					}
					if (node.fallback) this.fragment(node.fallback, scope, false);
					return;
				case 'keyed-list':
				case 'unkeyed-list':
					this.#list(node, scope);
					return;
				case 'keyed-block':
					this.expression(node.key, scope);
					this.fragment(node.body, scope, false);
					return;
				case 'async-block':
					this.expression(node.promise, scope);
					if (node.pending) this.fragment(node.pending, scope, false);
					if (node.resolved) this.#outcome(node.resolved, scope);
					if (node.rejected) this.#outcome(node.rejected, scope);
					return;
				case 'snippet':
					this.#snippet(node, scope);
					return;
				case 'render':
					this.expression(node.call, scope);
					return;
				case 'constant':
					this.declarator(node.declarator, scope, 'const', true);
					this.#within(node.declarator, () => {
						this.expression(node.declarator.id, scope);
						if (node.declarator.init) this.expression(node.declarator.init, scope);
					});
					return;
				case 'declaration':
					this.expression(node.declaration, scope);
					return;
				case 'debug':
					for (const identifier of node.identifiers) this.expression(identifier, scope);
					return;
				case 'title':
					for (const part of node.parts) {
						if (part.kind === 'expression')
							this.#within(part, () => this.expression(part.expression, scope));
					}
					return;
			}
		});
	}

	finish(): void {
		for (const [scope, reference] of this.#references) scope.reference(reference);
		for (const [scope, node] of this.#updates) {
			for (const leaf of leaves(node)) {
				const left = base(leaf);
				const binding: Binding | null = left === null ? null : scope.get(left.name);
				if (binding === null || left === binding.node) continue;
				if (left === leaf) binding.reassigned = true;
				else binding.mutated = true;
			}
		}
	}
}

function collectRest(pattern: ES.Node, inside: boolean, into: Set<ES.Identifier>): void {
	switch (pattern.type) {
		case 'Identifier':
			if (inside) into.add(pattern);
			return;
		case 'ObjectPattern':
			for (const property of pattern.properties) {
				collectRest(property.type === 'RestElement' ? property : property.value, inside, into);
			}
			return;
		case 'ArrayPattern':
			for (const element of pattern.elements)
				if (element !== null) collectRest(element, inside, into);
			return;
		case 'RestElement':
			collectRest(pattern.argument, true, into);
			return;
		case 'AssignmentPattern':
			collectRest(pattern.left, inside, into);
			return;
		default:
			return;
	}
}
