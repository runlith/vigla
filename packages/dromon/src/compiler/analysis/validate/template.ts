import type * as ES from 'estree';
import type * as IR from '../../ir/nodes.ts';
import { checkElement } from './a11y/index.ts';
import { binding, type Host } from './bindings.ts';
import type { Context } from './context.ts';
import {
	globalEvent,
	lowercaseComponent,
	placement,
	textPlacement,
	validateElement
} from './element.ts';
import { fail } from './report.ts';
import { identifiers, typeOf } from './scope.ts';

export class Template {
	readonly context: Context;
	readonly namespace: IR.Namespace;
	readonly #ancestors: IR.Node[] = [];

	constructor(context: Context, namespace: IR.Namespace) {
		this.context = context;
		this.namespace = namespace;
	}

	#scoped(node: object, run: () => void): void {
		const context = this.context;
		const saved = context.scope;
		const scope = context.scopes.map.get(node);
		if (scope !== undefined) context.scope = scope;
		run();
		context.scope = saved;
	}

	#parent(parent: string | null, run: () => void): void {
		const saved = this.context.parentElement;
		this.context.parentElement = parent;
		run();
		this.context.parentElement = saved;
	}

	fragment(fragment: IR.Fragment): void {
		this.#scoped(fragment, () => {
			this.context.within(fragment, () => {
				for (const node of fragment.nodes) this.node(node);
			});
		});
	}

	#expression(expression: ES.Node): void {
		this.context.es(expression);
	}

	#value(value: IR.Value): void {
		if (value.kind === 'expression') this.#expression(value.expression);
		else if (value.kind === 'text') {
			for (const part of value.parts) {
				if (part.kind === 'expression')
					this.context.within(part, () => this.#expression(part.expression));
			}
		}
	}

	attribute(attribute: IR.Attribute, host: Host | null): void {
		const context = this.context;
		const entered = context.report.enter(attribute);
		context.within(attribute, () => {
			switch (attribute.kind) {
				case 'attribute':
				case 'style':
					this.#value(attribute.value);
					return;
				case 'spread':
				case 'class':
				case 'attachment':
					this.#expression(attribute.expression);
					return;
				case 'binding':
					binding(context, attribute, host);
					return;
				case 'action':
					this.#expression(attribute.action);
					if (attribute.argument) this.#expression(attribute.argument);
					return;
				case 'transition':
					this.#expression(attribute.transition);
					if (attribute.argument) this.#expression(attribute.argument);
					return;
				case 'animation':
					this.#expression(attribute.animation);
					if (attribute.argument) this.#expression(attribute.argument);
					return;
			}
		});
		context.report.leave(entered);
	}

	#attributes(node: { readonly attributes: readonly IR.Attribute[] }, host: Host | null): void {
		for (const attribute of node.attributes) this.attribute(attribute, host);
	}

	node(node: IR.Node): void {
		const context = this.context;
		const entered = context.report.enter(node);
		this.#scoped(node, () => {
			this.#check(node);
			this.#ancestors.push(node);
			context.within(node, () => this.#children(node));
			this.#ancestors.pop();
			if (node.kind === 'snippet') this.#snippet(node);
		});
		context.report.leave(entered);
	}

	#check(node: IR.Node): void {
		const context = this.context;
		switch (node.kind) {
			case 'text':
			case 'expression':
				textPlacement(context, node);
				return;
			case 'element':
				validateElement(context, node);
				checkElement(node, { path: this.#ancestors, namespace: this.namespace }, context.report);
				lowercaseComponent(context, node);
				placement(context, node);
				return;
			case 'dynamic-element':
				validateElement(context, node);
				checkElement(node, { path: this.#ancestors, namespace: this.namespace }, context.report);
				return;
			case 'special':
				if (node.target === 'head') return;
				for (const attribute of node.attributes) {
					if (
						attribute.kind === 'attribute' &&
						attribute.name.startsWith('on') &&
						attribute.value.kind === 'expression'
					) {
						globalEvent(context, attribute);
					}
				}
				return;
			case 'keyed-list':
			case 'unkeyed-list': {
				const item = node.item;
				if (item?.type === 'Identifier' && (item.name === '$state' || item.name === '$derived')) {
					fail('state_invalid_placement', node, { rune: item.name });
				}
				return;
			}
			case 'snippet':
				context.snippets.push(node);
				return;
			case 'render': {
				for (const argument of this.#call(node).arguments) {
					if (argument.type === 'SpreadElement')
						fail('render_tag_invalid_spread_argument', argument);
				}
				return;
			}
			case 'declaration': {
				const path = context.path;
				if (path.length !== 1 || typeOf(path[0]!) !== 'fragment') return;
				for (const declarator of node.declaration.declarations) {
					for (const id of identifiers(declarator.id)) {
						if (context.instance?.declarations.has(id.name)) {
							fail('declaration_duplicate', id, { name: id.name });
						}
					}
				}
				return;
			}
			default:
				return;
		}
	}

	#call(node: IR.Render): ES.SimpleCallExpression {
		return node.call.type === 'ChainExpression'
			? (node.call.expression as ES.SimpleCallExpression)
			: node.call;
	}

	#children(node: IR.Node): void {
		const context = this.context;
		switch (node.kind) {
			case 'text':
			case 'comment':
				return;
			case 'expression':
			case 'raw-html':
				this.#expression(node.expression);
				return;
			case 'element':
				this.#attributes(node, node);
				this.#parent(node.name, () => this.fragment(node.body));
				return;
			case 'dynamic-element':
				this.#expression(node.tag);
				this.#attributes(node, node);
				this.#parent(null, () => this.fragment(node.body));
				return;
			case 'special':
				this.#attributes(node, node);
				this.fragment(node.body);
				return;
			case 'boundary':
				this.#attributes(node, null);
				this.fragment(node.body);
				return;
			case 'slot':
				this.#attributes(node, null);
				this.fragment(node.fallback);
				return;
			case 'component':
				this.#attributes(node, null);
				this.#parent(null, () => this.fragment(node.body));
				return;
			case 'branch':
				for (const arm of node.arms) {
					this.#expression(arm.test);
					this.fragment(arm.body);
				}
				if (node.fallback) this.fragment(node.fallback);
				return;
			case 'keyed-list':
			case 'unkeyed-list': {
				const inner = context.scope;
				context.scope = inner.parent ?? inner;
				this.#expression(node.collection);
				context.scope = inner;
				this.fragment(node.body);
				if (node.kind === 'keyed-list') this.#expression(node.key);
				if (node.fallback) this.fragment(node.fallback);
				return;
			}
			case 'keyed-block':
				this.#expression(node.key);
				this.fragment(node.body);
				return;
			case 'async-block':
				this.#expression(node.promise);
				if (node.pending) this.fragment(node.pending);
				if (node.resolved) this.fragment(node.resolved.body);
				if (node.rejected) this.fragment(node.rejected.body);
				return;
			case 'snippet':
				this.#parent(null, () => {
					this.#expression(node.name);
					for (const parameter of node.parameters) this.#expression(parameter);
					this.fragment(node.body);
				});
				return;
			case 'render': {
				const call = this.#call(node);
				this.#expression(call.callee);
				for (const argument of call.arguments) this.#expression(argument);
				return;
			}
			case 'constant':
				context.within(node.declarator, () => {
					context.es(node.declarator.id);
					const init = node.declarator.init;
					if (init) context.deeper(context.depth + 1, () => context.es(init));
				});
				return;
			case 'declaration':
				context.deeper(context.scope.depth, () => context.es(node.declaration));
				return;
			case 'debug':
				for (const identifier of node.identifiers) this.#expression(identifier);
				return;
			case 'title':
				for (const part of node.parts) {
					if (part.kind === 'expression')
						context.within(part, () => this.#expression(part.expression));
				}
				return;
		}
	}

	#snippet(node: IR.Snippet): void {
		const path = this.context.path;
		const name = node.name.name;
		if (
			path.length === 1 &&
			typeOf(path[0]!) === 'fragment' &&
			this.context.instance?.declarations.has(name)
		) {
			fail('declaration_duplicate', node.name, { name });
		}
		const parent = path.at(-2);
		if (parent === undefined || typeOf(parent) !== 'component') return;
		const component = parent as IR.Component;
		if (
			component.attributes.some(
				(a) => (a.kind === 'attribute' || a.kind === 'binding') && a.name === name
			)
		) {
			fail('snippet_shadowing_prop', node, { prop: name });
		}
		if (name !== 'children') return;
		if (
			component.body.nodes.some(
				(child) =>
					child.kind !== 'snippet' &&
					(child.kind !== 'text' || child.data.trim() !== '') &&
					child.kind !== 'comment'
			)
		) {
			fail('snippet_conflict', node);
		}
	}
}
