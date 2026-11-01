import type * as ES from 'estree';
import { isMathml, isSvg } from '../../shared/html.ts';
import { walk } from '../ir/estree.ts';
import type {
	Attribute,
	Component,
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
import type { Ignores } from '../ir/port.ts';
import {
	spanOf,
	unsupported,
	type Binding,
	type BindingKind,
	type Scope,
	type Scopes
} from './scope.ts';
import { clean, preserving, type Preserve } from './whitespace.ts';
import { declaring } from './asynchronous.ts';

export interface ListFacts {
	readonly names: readonly Binding[];
	readonly index: Binding | null;
}

interface SnippetReferences {
	readonly bindings: Set<Binding>;
	instance: boolean;
}

export function collectNames(node: ES.Node, names: Set<string>): void {
	walk(node, (child) => {
		if (child.type === 'Identifier') names.add(child.name);
	});
}

function childNamespace(element: Element, namespace: Namespace): Namespace {
	return element.name === 'foreignObject' ? 'html' : namespace;
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

const xmlns: Readonly<Record<string, Namespace>> = {
	'http://www.w3.org/2000/svg': 'svg',
	'http://www.w3.org/1998/Math/MathML': 'mathml',
	'http://www.w3.org/1999/xhtml': 'html'
};

function dynamicNamespace(node: DynamicElement, parent: Namespace): Namespace {
	for (const attribute of node.attributes) {
		if (attribute.kind !== 'attribute' || attribute.name !== 'xmlns') continue;
		const value = attribute.value;
		if (value.kind !== 'text' || !value.parts.every((part) => part.kind === 'text')) continue;
		const found = xmlns[value.parts.map((part) => (part as { data: string }).data).join('')];
		if (found !== undefined) return found;
	}
	return parent;
}

export function hoisted(node: Node): boolean {
	return node.kind === 'snippet' || node.kind === 'debug' || declaring(node);
}

function apart(node: Node): node is Special | Title {
	return node.kind === 'special' || node.kind === 'title';
}

export class Template {
	readonly scopes: Scopes;
	readonly preserve: Preserve;
	readonly names: Set<string>;
	readonly lists = new Map<KeyedList | UnkeyedList, ListFacts>();
	readonly fragments = new Map<Fragment, readonly Node[]>();
	readonly namespaces = new Map<Element | DynamicElement, Namespace>();
	readonly fragmentNamespaces = new Map<Fragment, Namespace>();
	readonly ignored = new Map<Node, ReadonlySet<string>>();
	readonly separate = new Map<Fragment, readonly (Special | Title)[]>();
	readonly placed = new Set<ES.Node>();
	readonly statements = new Set<ES.Node>();
	readonly #ignores: Ignores;
	#ignoring: ReadonlySet<string> | null = null;
	readonly #snippets = new Map<Binding, Snippet>();
	readonly #uses = new Map<Snippet, SnippetReferences>();
	#used: SnippetReferences | null = null;
	#depth = 0;
	inText = false;

	constructor(scopes: Scopes, preserve: Preserve, names: Set<string>, ignores: Ignores) {
		this.scopes = scopes;
		this.preserve = preserve;
		this.names = names;
		this.#ignores = ignores;
	}

	expression(expression: ES.Expression, scope: Scope): void {
		collectNames(expression, this.names);
		this.scopes.declare(expression, scope);
		this.scopes.resolve(expression, scope);
		const used = this.#used;
		walk(expression, (node, parent) => {
			if (node.type === 'Identifier') {
				const binding = used === null ? undefined : this.scopes.references.get(node);
				if (binding !== undefined) used?.bindings.add(binding);
			} else if (node.type === 'CallExpression' && this.scopes.runes.get(node.callee) === '$host') {
				if (used !== null) used.instance = true;
			} else if (node.type === 'VariableDeclarator' && node.init?.type === 'CallExpression') {
				this.placed.add(node.init.callee);
			} else if (
				node.type === 'CallExpression' &&
				parent?.type === 'ExpressionStatement' &&
				parent.expression === node
			) {
				this.statements.add(node.callee);
			}
		});
	}

	parameter(pattern: ES.Pattern, scope: Scope, defaulted: boolean): void {
		switch (pattern.type) {
			case 'Identifier':
				this.names.add(pattern.name);
				this.scopes.bind(scope, pattern, {
					kind: defaulted ? 'template-constant' : 'argument'
				});
				return;
			case 'AssignmentPattern':
				this.expression(pattern.right, scope);
				this.parameter(pattern.left, scope, true);
				return;
			case 'ObjectPattern':
				for (const property of pattern.properties) {
					if (property.type === 'RestElement') {
						this.parameter(property.argument, scope, defaulted);
						continue;
					}
					if (property.computed) this.expression(property.key as ES.Expression, scope);
					this.parameter(property.value, scope, defaulted);
				}
				return;
			case 'ArrayPattern':
				for (const element of pattern.elements) {
					if (element !== null) this.parameter(element, scope, defaulted);
				}
				return;
			case 'RestElement':
				this.parameter(pattern.argument, scope, defaulted);
				return;
			default:
				throw unsupported(spanOf(pattern), 'This snippet parameter pattern');
		}
	}

	lifted(instance: Scope): Set<Snippet> {
		const lifted = new Set<Snippet>();
		const instanceBinding = (binding: Binding): boolean =>
			instance.bindings.get(binding.name) === binding;
		const liftable = (snippet: Snippet, visiting: Set<Snippet>): boolean => {
			if (lifted.has(snippet)) return true;
			if (visiting.has(snippet)) return true;
			visiting.add(snippet);
			const uses = this.#uses.get(snippet);
			if (uses?.instance) return false;
			for (const binding of uses?.bindings ?? []) {
				if (!instanceBinding(binding)) continue;
				const other = this.#snippets.get(binding);
				if (other === undefined || !liftable(other, visiting)) return false;
			}
			return true;
		};
		for (const snippet of this.#snippets.values()) {
			if (liftable(snippet, new Set())) lifted.add(snippet);
		}
		return lifted;
	}

	pattern(pattern: ES.Pattern, scope: Scope, kind: BindingKind = 'item'): Binding[] {
		const bound: Binding[] = [];
		const visit = (node: ES.Pattern): void => {
			switch (node.type) {
				case 'Identifier':
					this.names.add(node.name);
					bound.push(this.scopes.bind(scope, node, { kind }));
					return;
				case 'ObjectPattern':
					for (const property of node.properties) {
						if (property.type === 'RestElement') {
							visit(property.argument);
							continue;
						}
						if (property.computed) this.expression(property.key as ES.Expression, scope);
						visit(property.value);
					}
					return;
				case 'ArrayPattern':
					for (const element of node.elements) if (element !== null) visit(element);
					return;
				case 'RestElement':
					visit(node.argument);
					return;
				case 'AssignmentPattern':
					this.expression(node.right, scope);
					visit(node.left);
					return;
				default:
					throw unsupported(spanOf(node), 'This destructuring pattern');
			}
		};
		visit(pattern);
		return bound;
	}

	fragment(
		fragment: Fragment,
		parent: Element | null,
		outer: Scope,
		inherited: boolean,
		namespace: Namespace,
		infer = parent === null
	): readonly Node[] {
		const name = parent?.name ?? null;
		const kept = inherited || (name !== null && preserving.has(name));
		const own = infer ? inferred(fragment.nodes, namespace) : namespace;
		const foreign = own === 'svg' && name !== 'text' && !this.inText;
		const separate = fragment.nodes.filter(apart);
		const given =
			separate.length === 0 ? fragment.nodes : fragment.nodes.filter((node) => !apart(node));
		if (separate.length > 0) this.separate.set(fragment, separate);
		const lifted = given.filter(hoisted);
		const regular = { nodes: lifted.length === 0 ? given : given.filter((node) => !hoisted(node)) };
		const scope = lifted.some(declaring) ? this.scopes.child(outer) : outer;
		const nodes = [
			...lifted,
			...clean(
				regular,
				name,
				{ whitespace: this.preserve.whitespace || kept, comments: this.preserve.comments },
				foreign
			)
		];
		this.fragments.set(fragment, nodes);
		this.fragmentNamespaces.set(fragment, own);
		const root = this.#depth === 0;
		for (const node of lifted) {
			if (node.kind !== 'snippet') continue;
			this.names.add(node.name.name);
			const binding = this.scopes.bind(scope, node.name, { kind: 'snippet' });
			if (root) this.#snippets.set(binding, node);
		}
		this.#depth++;
		try {
			for (const node of separate) this.node(node, scope, kept, own);
			for (const node of nodes) this.node(node, scope, kept, own);
		} finally {
			this.#depth--;
		}
		return nodes;
	}

	value(value: Extract<Attribute, { kind: 'attribute' }>['value'], scope: Scope): void {
		if (value.kind === 'expression') this.expression(value.expression, scope);
		else if (value.kind === 'text') {
			for (const part of value.parts) {
				if (part.kind === 'expression') this.expression(part.expression, scope);
			}
		}
	}

	attribute(attribute: Attribute, scope: Scope): void {
		switch (attribute.kind) {
			case 'attribute':
			case 'style':
				this.value(attribute.value, scope);
				return;
			case 'spread':
			case 'class':
			case 'attachment':
				this.expression(attribute.expression, scope);
				return;
			case 'action':
				this.expression(attribute.action, scope);
				if (attribute.argument !== null) this.expression(attribute.argument, scope);
				return;
			case 'transition':
				this.expression(attribute.transition, scope);
				if (attribute.argument !== null) this.expression(attribute.argument, scope);
				return;
			case 'animation':
				this.expression(attribute.animation, scope);
				if (attribute.argument !== null) this.expression(attribute.argument, scope);
				return;
			case 'binding':
				this.expression(attribute.expression, scope);
				this.scopes.bound(attribute.expression, scope);
				return;
		}
	}

	component(node: Component, scope: Scope, kept: boolean, namespace: Namespace): void {
		this.expression(node.reference, scope);
		for (const attribute of node.attributes) {
			switch (attribute.kind) {
				case 'attribute':
					this.value(attribute.value, scope);
					break;
				case 'spread':
				case 'attachment':
					this.expression(attribute.expression, scope);
					break;
				case 'binding':
					this.expression(attribute.expression, scope);
					this.scopes.bound(attribute.expression, scope);
					break;
				default:
					throw unsupported(attribute, `The ${attribute.kind} directive on a component`);
			}
		}
		this.fragment(node.body, null, this.scopes.child(scope), kept, namespace);
	}

	node(node: Node, scope: Scope, kept: boolean, namespace: Namespace): void {
		const outer = this.#ignoring;
		const codes = this.#ignores.get(node);
		if (codes !== undefined && codes.size > 0) {
			this.#ignoring = outer === null ? codes : new Set([...outer, ...codes]);
		}
		if (this.#ignoring !== null) this.ignored.set(node, this.#ignoring);
		try {
			this.visit(node, scope, kept, namespace);
		} finally {
			this.#ignoring = outer;
		}
	}

	visit(node: Node, scope: Scope, kept: boolean, namespace: Namespace): void {
		switch (node.kind) {
			case 'text':
			case 'comment':
				return;
			case 'expression':
			case 'raw-html':
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
			case 'component':
				this.component(node, scope, kept, namespace);
				return;
			case 'snippet': {
				const inner = this.scopes.root(scope);
				const outer = this.#used;
				if (this.#depth === 1) {
					this.#used = { bindings: new Set(), instance: false };
					this.#uses.set(node, this.#used);
				}
				try {
					for (const parameter of node.parameters) this.parameter(parameter, inner, false);
					this.fragment(node.body, null, inner, kept, namespace);
				} finally {
					this.#used = outer;
				}
				return;
			}
			case 'render':
				this.expression(node.call, scope);
				return;
			case 'slot':
				if (this.#used !== null) this.#used.instance = true;
				for (const attribute of node.attributes) this.attribute(attribute, scope);
				this.fragment(node.fallback, null, scope, kept, namespace);
				return;
			case 'boundary':
				for (const attribute of node.attributes) {
					if (attribute.kind !== 'attribute') {
						throw unsupported(attribute, `The ${attribute.kind} directive on a boundary`);
					}
					this.value(attribute.value, scope);
				}
				this.fragment(node.body, null, this.scopes.child(scope), kept, namespace);
				return;
			case 'branch':
				for (const arm of node.arms) {
					this.expression(arm.test, scope);
					this.fragment(arm.body, null, scope, kept, namespace);
				}
				if (node.fallback !== null) this.fragment(node.fallback, null, scope, kept, namespace);
				return;
			case 'keyed-list':
			case 'unkeyed-list': {
				this.expression(node.collection, scope);
				const inner = this.scopes.child(scope);
				const names = node.item === null ? [] : this.pattern(node.item, inner);
				let index: Binding | null = null;
				if (node.index !== null) {
					this.names.add(node.index.name);
					index = this.scopes.bind(inner, node.index, { kind: 'index' });
				}
				this.lists.set(node, { names, index });
				if (node.kind === 'keyed-list') this.expression(node.key, inner);
				this.fragment(node.body, null, inner, kept, namespace);
				if (node.fallback !== null) this.fragment(node.fallback, null, scope, kept, namespace);
				return;
			}
			case 'keyed-block':
				this.expression(node.key, scope);
				this.fragment(node.body, null, scope, kept, namespace);
				return;
			case 'async-block':
				this.expression(node.promise, scope);
				if (node.pending !== null) this.fragment(node.pending, null, scope, kept, namespace);
				for (const outcome of [node.resolved, node.rejected]) {
					if (outcome === null) continue;
					const inner = this.scopes.child(scope);
					if (outcome.binding !== null) this.pattern(outcome.binding, inner);
					this.fragment(outcome.body, null, inner, kept, namespace);
				}
				return;
			case 'dynamic-element': {
				this.expression(node.tag, scope);
				const own = dynamicNamespace(node, namespace);
				this.namespaces.set(node, own);
				for (const attribute of node.attributes) this.attribute(attribute, scope);
				this.fragment(node.body, null, scope, kept, own, false);
				return;
			}
			case 'constant': {
				const declarator = node.declarator;
				if (declarator.init != null) this.expression(declarator.init, scope);
				this.pattern(declarator.id, scope, 'template-constant');
				return;
			}
			case 'declaration':
				this.expression(node.declaration as unknown as ES.Expression, scope);
				return;
			case 'debug':
				for (const identifier of node.identifiers) this.expression(identifier, scope);
				return;
			case 'special':
				for (const attribute of node.attributes) this.attribute(attribute, scope);
				if (node.target === 'head') this.fragment(node.body, null, scope, kept, 'html', false);
				return;
			case 'title':
				for (const part of node.parts) {
					if (part.kind === 'expression') this.expression(part.expression, scope);
				}
				return;
			default:
				throw unsupported(node, 'This template node');
		}
	}
}
