import type { Context, Visitors } from 'esrap';
import type * as AST from '../ast.ts';
import { isVoid } from '../parse/html.ts';
import { attributes, block, lineBreak, type State } from './layout.ts';

type Node = { type: string; [key: string]: unknown };

const blockElements = new Set([
	'RegularElement',
	'Component',
	'SvelteBody',
	'SvelteHead',
	'SvelteFragment',
	'SvelteBoundary',
	'SvelteDocument',
	'SvelteSelf',
	'SvelteWindow',
	'SvelteComponent',
	'SvelteElement',
	'SlotElement',
	'TitleElement'
]);

const startsWithSpace = /^\s/;
const endsWithSpace = /\s$/;
const whitespaceRun = /[^\S]+/g;
const lineBreakChar = /[\r\n]/;

interface Item {
	nodes: Node[];
	leading: boolean;
}

function directive(
	context: Context,
	prefix: string,
	node: AST.Directive,
	withModifiers: boolean
): void {
	context.write(`${prefix}:${node.name}`);
	if (withModifiers) for (const modifier of node.modifiers) context.write(`|${modifier}`);
	const expression = node.expression as { type: string; name?: string } | null;
	if (expression !== null && !(expression.type === 'Identifier' && expression.name === node.name)) {
		context.write('={');
		context.visit(expression);
		context.write('}');
	}
}

export function templateVisitors(comments: readonly AST.JSComment[], state: State): Visitors {
	const preserved = (): boolean => state.preserve > 0;

	const element = (node: AST.ElementLike, context: Context): void => {
		const name = node.name.toLowerCase();
		const preserve =
			(node.type === 'RegularElement' || node.type === 'TitleElement') &&
			(name === 'pre' || name === 'textarea' || name === 'title');
		if (preserve) state.preserve += 1;
		const child = context.new();
		child.write(`<${node.name}`);
		const multiline = attributes(node, node.attributes, child, comments);
		const selfClosing =
			isVoid(node.name) || (node.type === 'Component' && node.fragment.nodes.length === 0);
		if (name === '!doctype') child.write('>');
		else if (selfClosing) child.write(`${multiline ? '' : ' '}/>`);
		else {
			child.write('>');
			block(child, node.fragment, preserved(), true);
			child.write(`</${node.name}>`);
		}
		context.append(child);
		if (preserve) state.preserve -= 1;
	};

	const fragment = (node: AST.Fragment, context: Context): void => {
		if (preserved()) {
			for (const child of node.nodes) {
				context.visit(child);
				context.multiline ||= child.type === 'Text' && lineBreakChar.test(child.data);
			}
			return;
		}
		const nodes = node.nodes;
		const first = nodes[0];
		const last = nodes.at(-1);
		const surrounded =
			first?.type === 'Text' &&
			startsWithSpace.test(first.data) &&
			last?.type === 'Text' &&
			endsWithSpace.test(last.data);

		const items: Item[] = [];
		let sequence: Node[] = [];
		let leading = false;
		const flush = (): void => {
			if (sequence.length > 0) {
				items.push({ nodes: sequence, leading });
				sequence = [];
				leading = false;
			}
		};

		for (let index = 0; index < nodes.length; index += 1) {
			const child = nodes[index] as AST.TemplateNode;
			const previous = nodes[index - 1];
			const following = nodes[index + 1];
			if (child.type !== 'Text') {
				const isBlock = blockElements.has(child.type);
				if (isBlock && sequence.length > 0) flush();
				sequence.push(child as unknown as Node);
				if (isBlock) flush();
				continue;
			}
			let data = child.data.replace(whitespaceRun, ' ');
			if (index === 0) data = data.trimStart();
			if (index === nodes.length - 1) data = data.trimEnd();
			if (data === '') continue;
			if (data.startsWith(' ') && previous && previous.type !== 'ExpressionTag') {
				flush();
				leading = true;
				data = data.trimStart();
			}
			if (data !== '') {
				sequence.push({ ...child, data } as unknown as Node);
				if (data.endsWith(' ') && following && following.type !== 'ExpressionTag') flush();
			}
		}
		flush();

		let multiline = false;
		let width = 0;
		const contexts = items.map((item) => {
			const child = context.new();
			for (const part of item.nodes) {
				child.visit(part);
				multiline ||= child.multiline;
			}
			width += child.measure() + (item.leading ? 1 : 0);
			return { context: child, leading: item.leading };
		});
		multiline ||= width > lineBreak;
		context.multiline ||= surrounded && width > lineBreak * 2;

		for (let index = 0; index < contexts.length; index += 1) {
			const current = contexts[index] as { context: Context; leading: boolean };
			const following = contexts[index + 1];
			context.append(current.context);
			if (following === undefined) continue;
			if (current.context.multiline || following.context.multiline) {
				context.margin();
				context.newline();
			} else if (multiline) {
				context.newline();
			} else if (following.leading) {
				context.write(' ');
			}
		}
	};

	const dynamic = (
		node: AST.ElementLike,
		context: Context,
		tag: string,
		value: unknown,
		inline: boolean
	): void => {
		context.write(`<${tag}${tag === 'svelte:element' ? ' ' : ' '}this={`);
		context.visit(value as Node);
		context.write('}');
		attributes(node, node.attributes, context, comments);
		if (node.fragment.nodes.length > 0) {
			context.write('>');
			block(context, node.fragment, preserved(), inline);
			context.write(`</${tag}>`);
		} else {
			context.write(' />');
		}
	};

	const visitors: Record<string, (node: never, context: Context) => void> = {
		Root(node: AST.Root, context: Context) {
			if (node.options) {
				context.write('<svelte:options');
				for (const attribute of node.options.attributes) {
					context.write(' ');
					context.visit(attribute);
				}
				context.write(' />');
			}
			let started = false;
			for (const item of [node.module, node.instance, node.fragment, node.css]) {
				if (!item) continue;
				if (started) {
					context.margin();
					context.newline();
				}
				context.visit(item);
				started = true;
			}
		},
		Script(node: AST.Script, context: Context) {
			context.write('<script');
			attributes(node, node.attributes, context, comments);
			context.write('>');
			block(context, node.content, preserved());
			context.write('</script>');
		},
		Fragment: fragment,
		AnimateDirective(node: AST.Directive, context: Context) {
			directive(context, 'animate', node, false);
		},
		AttachTag(node: AST.AttachTag, context: Context) {
			context.write('{@attach ');
			context.visit(node.expression);
			context.write('}');
		},
		Attribute(node: AST.Attribute, context: Context) {
			context.write(node.name);
			if (node.value === true) return;
			context.write('=');
			if (!Array.isArray(node.value)) {
				context.visit(node.value);
				return;
			}
			const quoted = node.value.length > 1 || node.value[0]?.type === 'Text';
			if (quoted) context.write('"');
			for (const chunk of node.value) context.visit(chunk);
			if (quoted) context.write('"');
		},
		AwaitBlock(node: AST.AwaitBlock, context: Context) {
			context.write('{#await ');
			context.visit(node.expression);
			if (node.pending) {
				context.write('}');
				block(context, node.pending, preserved());
				if (node.then || node.catch) context.write('{:');
			} else {
				context.write(' ');
			}
			if (node.then) {
				context.write(node.value ? 'then ' : 'then');
				if (node.value) context.visit(node.value);
				context.write('}');
				block(context, node.then, preserved());
				if (node.catch) context.write('{:');
			}
			if (node.catch) {
				context.write(node.error ? 'catch ' : 'catch');
				if (node.error) context.visit(node.error);
				context.write('}');
				block(context, node.catch, preserved());
			}
			context.write('{/await}');
		},
		BindDirective(node: AST.Directive, context: Context) {
			context.write(`bind:${node.name}`);
			const expression = node.expression as ES;
			if (expression.type === 'Identifier' && expression.name === node.name) return;
			context.write('={');
			if (expression.type === 'SequenceExpression') {
				const [getter, setter] = expression.expressions as Node[];
				context.visit(getter as Node);
				context.write(', ');
				context.visit(setter as Node);
			} else {
				context.visit(expression);
			}
			context.write('}');
		},
		ClassDirective(node: AST.Directive, context: Context) {
			directive(context, 'class', node, false);
		},
		Comment(node: AST.Comment, context: Context) {
			context.write(`<!--${node.data}-->`);
		},
		ConstTag(node: AST.ConstTag, context: Context) {
			context.write('{@const ');
			node.declaration.declarations.forEach((declarator, index) => {
				if (index > 0) context.write(', ');
				context.visit(declarator);
			});
			context.write('}');
		},
		DeclarationTag(node: AST.DeclarationTag, context: Context) {
			context.write('{');
			const open = context.new();
			const join = context.new();
			const child = context.new();
			context.append(child);
			child.write(`${node.declaration.kind} `);
			child.append(open);
			const declarations = node.declaration.declarations;
			declarations.forEach((declarator, index) => {
				if (index > 0) child.append(join);
				child.visit(declarator);
			});
			const length = child.measure() + 2 * (declarations.length - 1);
			if (child.multiline || (declarations.length > 1 && length > 50)) {
				context.multiline = true;
				if (declarations.length > 1) open.indent();
				join.write(',');
				join.newline();
				if (declarations.length > 1) context.dedent();
			} else {
				join.write(', ');
			}
			context.write('}');
		},
		DebugTag(node: AST.DebugTag, context: Context) {
			context.write('{@debug ');
			node.identifiers.forEach((identifier, index) => {
				if (index > 0) context.write(', ');
				context.visit(identifier);
			});
			context.write('}');
		},
		EachBlock(node: AST.EachBlock, context: Context) {
			context.write('{#each ');
			context.visit(node.expression);
			if (node.context) {
				context.write(' as ');
				context.visit(node.context);
			}
			if (node.index) context.write(`, ${node.index}`);
			if (node.key) {
				context.write(' (');
				context.visit(node.key);
				context.write(')');
			}
			context.write('}');
			block(context, node.body, preserved());
			if (node.fallback) {
				context.write('{:else}');
				block(context, node.fallback, preserved());
			}
			context.write('{/each}');
		},
		ExpressionTag(node: AST.ExpressionTag, context: Context) {
			context.write('{');
			context.visit(node.expression);
			context.write('}');
		},
		HtmlTag(node: AST.HtmlTag, context: Context) {
			context.write('{@html ');
			context.visit(node.expression);
			context.write('}');
		},
		IfBlock(node: AST.IfBlock, context: Context) {
			context.write(node.elseif ? '{:else if ' : '{#if ');
			context.visit(node.test);
			context.write('}');
			block(context, node.consequent, preserved());
			if (node.alternate !== null) {
				const only = node.alternate.nodes[0];
				if (node.alternate.nodes.length === 1 && only?.type === 'IfBlock' && only.elseif) {
					context.visit(node.alternate);
				} else {
					context.write('{:else}');
					block(context, node.alternate, preserved());
				}
			}
			if (!node.elseif) context.write('{/if}');
		},
		KeyBlock(node: AST.KeyBlock, context: Context) {
			context.write('{#key ');
			context.visit(node.expression);
			context.write('}');
			block(context, node.fragment, preserved());
			context.write('{/key}');
		},
		LetDirective(node: AST.Directive, context: Context) {
			directive(context, 'let', node, false);
		},
		OnDirective(node: AST.Directive, context: Context) {
			directive(context, 'on', node, true);
		},
		RenderTag(node: AST.RenderTag, context: Context) {
			context.write('{@render ');
			context.visit(node.expression);
			context.write('}');
		},
		SnippetBlock(node: AST.SnippetBlock, context: Context) {
			context.write('{#snippet ');
			context.visit(node.expression);
			if (node.typeParams) context.write(`<${node.typeParams}>`);
			context.write('(');
			node.parameters.forEach((parameter, index) => {
				if (index > 0) context.write(', ');
				context.visit(parameter);
			});
			context.write(')}');
			block(context, node.body, preserved());
			context.write('{/snippet}');
		},
		SpreadAttribute(node: AST.SpreadAttribute, context: Context) {
			context.write('{...');
			context.visit(node.expression);
			context.write('}');
		},
		StyleDirective(node: AST.StyleDirective, context: Context) {
			context.write(`style:${node.name}`);
			for (const modifier of node.modifiers) context.write(`|${modifier}`);
			if (node.value === true) return;
			context.write('=');
			if (Array.isArray(node.value)) {
				context.write('"');
				for (const chunk of node.value) context.visit(chunk);
				context.write('"');
			} else {
				context.visit(node.value);
			}
		},
		SvelteComponent(node: AST.ElementLike, context: Context) {
			dynamic(node, context, 'svelte:component', node.expression, true);
		},
		SvelteElement(node: AST.ElementLike, context: Context) {
			dynamic(node, context, 'svelte:element', node.tag, false);
		},
		Text(node: AST.Text, context: Context) {
			context.write(node.data);
		},
		TransitionDirective(node: AST.Directive, context: Context) {
			const prefix = node.intro && node.outro ? 'transition' : node.intro ? 'in' : 'out';
			directive(context, prefix, node, true);
		},
		UseDirective(node: AST.Directive, context: Context) {
			directive(context, 'use', node, false);
		}
	};
	for (const type of [
		'Component',
		'RegularElement',
		'SlotElement',
		'SvelteBody',
		'SvelteBoundary',
		'SvelteDocument',
		'SvelteFragment',
		'SvelteHead',
		'SvelteSelf',
		'SvelteWindow',
		'TitleElement'
	]) {
		visitors[type] = element as (node: never, context: Context) => void;
	}
	return visitors as unknown as Visitors;
}

type ES = Node & { name?: string; expressions?: Node[] };
