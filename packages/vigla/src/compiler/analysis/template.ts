import type * as ES from 'estree';
import { isMathml, isSvg } from '../../shared/html.ts';
import { walk } from '../ir/estree.ts';
import type {
	Attribute,
	Component,
	Element,
	Fragment,
	KeyedList,
	Namespace,
	Node,
	UnkeyedList,
	Value
} from '../ir/nodes.ts';
import type { Ignores } from '../ir/port.ts';
import { spanOf, unsupported, type Binding, type Scope, type Scopes } from './scope.ts';
import { clean, preserving, type Preserve } from './whitespace.ts';

export interface ListFacts {
	readonly item: Binding;
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
		case 'boundary':
			if (node.kind === 'component') found.push(node.reference);
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

function hoisted(node: Node): boolean {
	return node.kind === 'snippet';
}

export class Template {
	readonly scopes: Scopes;
	readonly preserve: Preserve;
	readonly names: Set<string>;
	readonly lists = new Map<KeyedList | UnkeyedList, ListFacts>();
	readonly fragments = new Map<Fragment, readonly Node[]>();
	readonly namespaces = new Map<Element, Namespace>();
	readonly fragmentNamespaces = new Map<Fragment, Namespace>();
	readonly ignored = new Map<Node, ReadonlySet<string>>();
	readonly #ignores: Ignores;
	#ignoring: ReadonlySet<string> | null = null;
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
		const lifted = fragment.nodes.filter(hoisted);
		const regular =
			lifted.length === 0 ? fragment : { nodes: fragment.nodes.filter((node) => !hoisted(node)) };
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
		for (const node of lifted) {
			if (node.kind !== 'snippet') continue;
			this.names.add(node.name.name);
			this.scopes.bind(scope, node.name, { kind: 'snippet' });
		}
		for (const node of nodes) this.node(node, scope, kept, own);
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
				this.fragment(node.body, null, inner, kept, namespace);
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
				if (node.item === null || node.item.type !== 'Identifier') {
					throw unsupported(node, 'An each block without a single item name');
				}
				this.expression(node.collection, scope);
				const inner = this.scopes.child(scope);
				this.names.add(node.item.name);
				const item = this.scopes.bind(inner, node.item, { kind: 'item' });
				let index: Binding | null = null;
				if (node.index !== null) {
					this.names.add(node.index.name);
					index = this.scopes.bind(inner, node.index, { kind: 'index' });
				}
				this.lists.set(node, { item, index });
				if (node.kind === 'keyed-list') this.expression(node.key, inner);
				this.fragment(node.body, null, inner, kept, namespace);
				if (node.fallback !== null) this.fragment(node.fallback, null, scope, kept, namespace);
				return;
			}
			default:
				throw unsupported(node, `The ${node.kind} node`);
		}
	}
}
