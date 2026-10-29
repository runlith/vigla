import type * as ES from 'estree';
import { escapeAttribute, escapeContent } from '../../shared/escape.ts';
import { isVoid } from '../../shared/html.ts';
import { arm, close, fallback, open } from '../../shared/markers.ts';
import {
	spanOf,
	unsupported,
	type Binding,
	type ComponentAnalysis,
	type ModuleAnalysis,
	type ScriptAnalysis
} from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import type { Fragment, Node, Text } from '../ir/nodes.ts';

export interface ModuleOptions {
	readonly runtime: string;
}

export interface ServerOptions extends ModuleOptions {
	readonly name: string;
}

interface Context {
	readonly analysis: ScriptAnalysis;
	readonly names: b.Names;
	readonly runtime: ES.Identifier;
}

interface TemplateContext extends Context {
	readonly component: ComponentAnalysis;
	readonly out: ES.Identifier;
}

function runtime(
	context: Context,
	name: string,
	...args: ES.Expression[]
): ES.SimpleCallExpression {
	return b.call(b.member(context.runtime, name), ...args);
}

function argument(node: ES.CallExpression): ES.Expression {
	const [first, ...rest] = node.arguments;
	if (rest.length > 0 || first?.type === 'SpreadElement') {
		throw unsupported(spanOf(node), 'A rune with more than one argument');
	}
	return first ?? b.id('undefined');
}

function derived(binding: Binding | undefined): boolean {
	return binding?.kind === 'derived';
}

function rewrite<T extends ES.Node>(context: Context, node: T): T {
	const { references, runes } = context.analysis;
	return b.rewrite(node, (current, next) => {
		switch (current.type) {
			case 'Identifier':
				return derived(references.get(current)) ? b.call(current) : undefined;
			case 'Property': {
				if (current.computed || current.kind !== 'init') return undefined;
				const value = next(current.value);
				return value === current.value ? current : { ...current, shorthand: false, value };
			}
			case 'AssignmentExpression':
			case 'UpdateExpression': {
				const target = current.type === 'AssignmentExpression' ? current.left : current.argument;
				const binding = target.type === 'Identifier' ? references.get(target) : undefined;
				if (derived(binding) || binding?.kind === 'item') {
					throw unsupported(spanOf(current), `Assigning to a ${binding?.kind ?? ''} binding`);
				}
				return undefined;
			}
			case 'VariableDeclarator': {
				const init = current.init;
				if (init?.type !== 'CallExpression') return undefined;
				const rune = runes.get(init.callee);
				if (rune === undefined) return undefined;
				const value = next(argument(init));
				switch (rune) {
					case '$state':
					case '$state.raw':
						return { ...current, init: value };
					case '$derived':
						return { ...current, init: runtime(context, 'derived', b.arrow([], value)) };
					case '$derived.by':
						return { ...current, init: runtime(context, 'derived', value) };
					default:
						throw unsupported(spanOf(init), `The ${rune} rune`);
				}
			}
			default:
				return undefined;
		}
	});
}

class Buffer {
	#quasis: string[] = [''];
	#values: ES.Expression[] = [];

	text(html: string): void {
		this.#quasis[this.#quasis.length - 1] += html;
	}

	value(expression: ES.Expression): void {
		this.#values.push(expression);
		this.#quasis.push('');
	}

	flush(context: TemplateContext, statements: ES.Statement[]): void {
		if (this.#values.length === 0 && this.#quasis[0] === '') return;
		statements.push(
			b.statement(b.call(b.member(context.out, 'push'), b.template(this.#quasis, this.#values)))
		);
		this.#quasis = [''];
		this.#values = [];
	}
}

function cleaned(context: TemplateContext, fragment: Fragment): readonly Node[] {
	const nodes = context.component.fragments.get(fragment);
	if (nodes === undefined) throw new Error('fragment was not analyzed');
	return nodes;
}

function block(
	context: TemplateContext,
	marker: string,
	fragment: Fragment | null
): ES.BlockStatement {
	const statements: ES.Statement[] = [];
	const buffer = new Buffer();
	buffer.text(marker);
	if (fragment !== null) render(context, cleaned(context, fragment), statements, buffer);
	buffer.flush(context, statements);
	return { type: 'BlockStatement', body: statements };
}

function render(
	context: TemplateContext,
	nodes: readonly Node[],
	statements: ES.Statement[],
	buffer: Buffer
): void {
	for (const node of nodes) {
		switch (node.kind) {
			case 'text':
				buffer.text(escapeContent(node.data));
				break;
			case 'comment':
				buffer.text(`<!--${node.data}-->`);
				break;
			case 'expression':
				buffer.value(runtime(context, 'escape', rewrite(context, node.expression)));
				break;
			case 'element': {
				buffer.text(`<${node.name}`);
				for (const attribute of node.attributes) {
					if (attribute.kind !== 'attribute')
						throw unsupported(attribute, `The ${attribute.kind} directive`);
					const { value } = attribute;
					if (value.kind === 'boolean') buffer.text(` ${attribute.name}`);
					else if (value.kind === 'text') {
						const text = value.parts.map((part) => (part as Text).data).join('');
						buffer.text(` ${attribute.name}="${escapeAttribute(text)}"`);
					}
				}
				buffer.text('>');
				render(context, cleaned(context, node.body), statements, buffer);
				if (!isVoid(node.name)) buffer.text(`</${node.name}>`);
				break;
			}
			case 'branch': {
				buffer.flush(context, statements);
				let chain: ES.Statement = block(context, arm(fallback), node.fallback);
				for (let index = node.arms.length - 1; index >= 0; index--) {
					const entry = node.arms[index];
					if (entry === undefined) continue;
					chain = {
						type: 'IfStatement',
						test: rewrite(context, entry.test),
						consequent: block(context, arm(index), entry.body),
						alternate: chain
					};
				}
				statements.push(chain);
				buffer.text(close);
				break;
			}
			case 'keyed-list':
			case 'unkeyed-list': {
				const binding = context.component.items.get(node);
				if (binding === undefined) throw new Error('each block was not analyzed');
				buffer.text(open);
				buffer.flush(context, statements);
				const body = block(context, '', node.body);
				statements.push({
					type: 'ForOfStatement',
					await: false,
					left: {
						type: 'VariableDeclaration',
						kind: 'const',
						declarations: [{ type: 'VariableDeclarator', id: b.id(binding.name), init: null }]
					},
					right: runtime(context, 'iterate', rewrite(context, node.collection)),
					body
				});
				buffer.text(close);
				break;
			}
			default:
				throw unsupported(node, `The ${node.kind} node`);
		}
	}
}

export function server(analysis: ComponentAnalysis, options: ServerOptions): ES.Program {
	const names = new b.Names(analysis.names);
	const context: TemplateContext = {
		analysis,
		component: analysis,
		names,
		runtime: b.id(names.unique('$')),
		out: b.id(names.unique('$$out'))
	};
	const props = b.id(names.unique('$$props'));
	const imports: ES.ImportDeclaration[] = [];
	const body: ES.Statement[] = [];
	for (const statement of analysis.unit.instance?.body ?? []) {
		if (statement.type === 'ImportDeclaration') imports.push(statement);
		else if (statement.type.startsWith('Export'))
			throw unsupported(spanOf(statement), 'An export from a component');
		else body.push(rewrite(context, statement as ES.Statement));
	}
	const buffer = new Buffer();
	render(context, analysis.root, body, buffer);
	buffer.flush(context, body);
	return b.program([
		b.namespaceImport(context.runtime.name, options.runtime),
		...imports,
		b.exportDefaultFunction(options.name, [context.out, props], body)
	]);
}

export function serverModule(analysis: ModuleAnalysis, options: ModuleOptions): ES.Program {
	const names = new b.Names(analysis.names);
	const context: Context = { analysis, names, runtime: b.id(names.unique('$')) };
	const body = analysis.unit.program.body.map((statement) => rewrite(context, statement));
	return b.program([b.namespaceImport(context.runtime.name, options.runtime), ...body]);
}
