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
	UnkeyedList,
	Value
} from '../ir/nodes.ts';
import type { Ignores } from '../ir/port.ts';
import { spanOf, unsupported, type Binding, type Scope, type Scopes } from './scope.ts';
import { clean, preserving, type Preserve } from './whitespace.ts';

export interface ListFacts {
	readonly names: readonly Binding[];
	readonly index: Binding | null;
}

export function collectNames(node: ES.Node, names: Set<string>): void {
	walk(node, (child) => {
		if (child.type === 'Identifier') names.add(child.name);
	});
}

export function hasAwait(node: ES.Node): boolean {
	let found = false;
	walk(node, (child) => {
		if (found) return false;
		if (
			child.type === 'FunctionDeclaration' ||
			child.type === 'FunctionExpression' ||
			child.type === 'ArrowFunctionExpression' ||
			child.type === 'ClassBody'
		) {
			return false;
		}
		if (child.type === 'AwaitExpression' || (child.type === 'ForOfStatement' && child.await)) {
			found = true;
			return false;
		}
	});
	return found;
}

export function ownExpressions(node: Node): ES.Expression[] {
	const found: ES.Expression[] = [];
	const value = (given: Value): void => {
		if (given.kind === 'expression') found.push(given.expression);
		else if (given.kind === 'text') {
			for (const part of given.parts) if (part.kind === 'expression') found.push(part.expression);
		}
	};
	switch (node.kind) {
		case 'expression':
		case 'raw-html':
			found.push(node.expression);
			break;
		case 'element':
		case 'component':
		case 'dynamic-element':
		case 'boundary':
			if (node.kind === 'component') found.push(node.reference);
			if (node.kind === 'dynamic-element') found.push(node.tag);
			for (const attribute of node.attributes) {
				switch (attribute.kind) {
					case 'attribute':
					case 'style':
						value(attribute.value);
						break;
					case 'spread':
					case 'class':
					case 'attachment':
						found.push(attribute.expression);
						break;
					case 'action':
						found.push(attribute.action);
						if (attribute.argument !== null) found.push(attribute.argument);
						break;
					default:
						break;
				}
			}
			break;
		case 'branch':
			for (const arm of node.arms) found.push(arm.test);
			break;
		case 'keyed-list':
		case 'unkeyed-list':
			found.push(node.collection);
			break;
		case 'keyed-block':
			found.push(node.key);
			break;
		case 'async-block':
			found.push(node.promise);
			break;
		case 'render': {
			const call = (
				node.call.type === 'ChainExpression' ? node.call.expression : node.call
			) as ES.SimpleCallExpression;
			found.push(call.callee as ES.Expression);
			for (const argument of call.arguments) {
				if (argument.type !== 'SpreadElement') found.push(argument);
			}
			break;
		}
		default:
			break;
	}
	return found;
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

function hoisted(node: Node): boolean {
	return node.kind === 'snippet';
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
	readonly #uses = new Map<Snippet, Set<Binding>>();
	#used: Set<Binding> | null = null;
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
				if (binding !== undefined) used?.add(binding);
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

	lifted(instance: Scope): Set<Snippet> {
		const lifted = new Set<Snippet>();
		const instanceBinding = (binding: Binding): boolean =>
			instance.bindings.get(binding.name) === binding;
		const liftable = (snippet: Snippet, visiting: Set<Snippet>): boolean => {
			if (lifted.has(snippet)) return true;
			if (visiting.has(snippet)) return true;
			visiting.add(snippet);
			for (const binding of this.#uses.get(snippet) ?? []) {
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

	pattern(pattern: ES.Pattern, scope: Scope): Binding[] {
		const bound: Binding[] = [];
		const visit = (node: ES.Pattern): void => {
			switch (node.type) {
				case 'Identifier':
					this.names.add(node.name);
					bound.push(this.scopes.bind(scope, node, { kind: 'item' }));
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
		scope: Scope,
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
			case 'binding':
				this.expression(attribute.expression, scope);
				this.scopes.bound(attribute.expression, scope);
				return;
			default:
				throw unsupported(attribute, `The ${attribute.kind} directive`);
		}
	}

	component(node: Component, scope: Scope, kept: boolean, namespace: Namespace): void {
		this.expression(node.reference, scope);
		for (const attribute of node.attributes) {
			switch (attribute.kind) {
				case 'attribute':
					if (attribute.name.startsWith('--')) {
						throw unsupported(attribute, 'A CSS custom property on a component');
					}
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
				for (const parameter of node.parameters) {
					if (parameter.type !== 'Identifier') {
						throw unsupported(spanOf(parameter), 'A snippet parameter pattern or default');
					}
					this.names.add(parameter.name);
					this.scopes.bind(inner, parameter, { kind: 'argument' });
				}
				const outer = this.#used;
				if (this.#depth === 1) {
					this.#used = new Set();
					this.#uses.set(node, this.#used);
				}
				try {
					this.fragment(node.body, null, inner, kept, namespace);
				} finally {
					this.#used = outer;
				}
				return;
			}
			case 'render':
				this.expression(node.call, scope);
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
				throw unsupported(node, `The ${node.kind} node`);
		}
	}
}
