import type * as ES from 'estree';
import type { Format } from '../../shared/format.ts';
import type { RuntimeNames } from '../ir/runtime.ts';
import {
	patternNames,
	spanOf,
	unsupported,
	type ComponentAnalysis,
	type ModuleAnalysis
} from '../analysis/index.ts';
import type { InjectedStyle, Scoping } from '../css/index.ts';
import * as b from '../ir/estree.ts';
import { hotComponent } from './hot.ts';
import { accessors, customElement } from './custom-element.ts';
import { prepare } from './external.ts';
import { deferExports } from './exports.ts';
import { traceStacks } from './inspect.ts';
import { Positions } from './meta.ts';
import { read, rewrite, runtime, type Context } from './script.ts';
import { separateCode } from './special.ts';
import { render, type TemplateContext } from './template.ts';

export interface ModuleOptions {
	readonly runtime: string;
	readonly runtimeNames?: RuntimeNames;
	readonly dev: boolean;
}

export interface ClientOptions extends ModuleOptions {
	readonly name: string;
	readonly format: Format;
	readonly scoping: Scoping;
	readonly styles: InjectedStyle | null;
	readonly hmr: boolean;
	readonly filename: string;
	readonly discloseVersion: string | false;
}

function topLevelAwaits(analysis: ComponentAnalysis): Set<ES.Node> {
	const found = new Set<ES.Node>();
	const program = analysis.unit.instance;
	if (program === null) return found;
	b.walk(program, (node) => {
		if (
			node.type === 'FunctionDeclaration' ||
			node.type === 'FunctionExpression' ||
			node.type === 'ArrowFunctionExpression' ||
			node.type === 'ClassBody'
		) {
			return false;
		}
		if (node.type === 'CallExpression') {
			const rune = analysis.runes.get(node.callee);
			if (rune === '$derived' || rune === '$derived.by') return false;
		}
		if (node.type === 'AwaitExpression') found.add(node);
	});
	return found;
}

function declaredNames(declaration: ES.Declaration): ES.Identifier[] {
	if (declaration.type === 'VariableDeclaration') {
		return declaration.declarations.flatMap((declarator) => patternNames(declarator.id));
	}
	return declaration.id === null ? [] : [declaration.id];
}

function exportProperties(context: Context, name: string, local: ES.Identifier): ES.Property[] {
	const binding =
		context.analysis.references.get(local) ?? context.analysis.declarations.get(local);
	const value =
		(binding === undefined ? undefined : read(context, { ...local }, binding)) ??
		rewrite(context, local);
	const getter: ES.Property = {
		type: 'Property',
		key: b.literal(name),
		value: b.functionExpression([], [{ type: 'ReturnStatement', argument: value }]),
		kind: 'get',
		method: false,
		shorthand: false,
		computed: false
	};
	const next = b.id(context.names.unique('$$value'));
	let write: ES.Expression | undefined;
	if (binding?.kind === 'prop') write = b.call({ ...local }, next);
	else if (binding?.kind === 'state' || binding?.kind === 'raw-state')
		write = runtime(
			context,
			'set',
			{ ...local },
			binding.kind === 'state' ? runtime(context, 'proxy', next) : next
		);
	else if (
		binding?.kind === 'normal' &&
		(binding.declarationKind === 'let' || binding.declarationKind === 'var')
	)
		write = { type: 'AssignmentExpression', operator: '=', left: { ...local }, right: next };
	return write === undefined
		? [getter]
		: [
				getter,
				{
					...getter,
					kind: 'set',
					value: b.functionExpression([next], [b.statement(write)])
				}
			];
}

export function client(analysis: ComponentAnalysis, options: ClientOptions): ES.Program {
	const names = new b.Names(analysis.names);
	const id = b.id(names.unique('$'));
	const anchor = b.id(names.unique('$$anchor'));
	const props = b.id(names.unique('$$props'));
	const context: TemplateContext = {
		analysis,
		component: analysis,
		names,
		runtime: id,
		runtimeNames: options.runtimeNames,
		plain: new Set(),
		hoisted: [],
		props,
		events: new Set(),
		groups: new Map(),
		instance: [],
		scoping: options.scoping,
		positions: new Positions(options.dev ? analysis.unit.source : '', options.filename),
		filename: options.filename,
		format: options.format,
		dev: options.dev,
		aliases: new Map(),
		renamed: new Map(),
		externalCells: new Map()
	};
	traceStacks(context);
	if (options.discloseVersion !== false) {
		context.hoisted.push(
			b.statement(
				runtime(
					context,
					'disclose',
					b.literal(options.format.global),
					b.literal(options.discloseVersion)
				)
			)
		);
	}
	const imports: ES.ImportDeclaration[] = [];
	const level: (ES.Statement | ES.ModuleDeclaration)[] = [];
	for (const statement of analysis.unit.module?.body ?? []) {
		if (statement.type === 'ImportDeclaration') imports.push(statement);
		else level.push(rewrite({ ...context, props: null }, statement as ES.Statement));
	}
	const body: ES.Statement[] = [];
	if (options.styles !== null) {
		const css = names.unique('$$css');
		const { hash, code } = options.styles;
		context.hoisted.push(
			b.constant(css, b.object({ hash: b.literal(hash), code: b.literal(code) }))
		);
		body.push(b.statement(runtime(context, 'appendStyles', anchor, b.id(css))));
	}
	body.push(b.statement(runtime(context, 'push')));
	const script = prepare(context, [...new Set(analysis.externals.values())]);
	const exported: ES.Property[] = [];
	const saving: Context = analysis.asynchronous
		? { ...context, saved: topLevelAwaits(analysis) }
		: context;
	for (const statement of analysis.unit.instance?.body ?? []) {
		if (statement.type === 'ImportDeclaration') imports.push(statement);
		else if (statement.type === 'ExportNamedDeclaration' && statement.source == null) {
			if (statement.declaration != null) {
				script.push(rewrite(saving, statement.declaration));
				for (const name of declaredNames(statement.declaration)) {
					exported.push(...exportProperties(context, name.name, name));
				}
			}
			for (const specifier of statement.specifiers) {
				const local = specifier.local as ES.Identifier;
				const name =
					specifier.exported.type === 'Identifier'
						? specifier.exported.name
						: String(specifier.exported.value);
				exported.push(...exportProperties(context, name, local));
			}
		} else if (statement.type.startsWith('Export'))
			throw unsupported(spanOf(statement), 'This export from a component');
		else script.push(rewrite(saving, statement as ES.Statement));
	}
	const exposed = [...exported, ...accessors(context)];
	const deferred =
		analysis.asynchronous && exposed.length > 0 ? deferExports(context, exposed) : null;
	if (deferred !== null) body.push(deferred.setup);
	const separate = separateCode(context, analysis.unit.template);
	if (analysis.asynchronous) {
		const inner = b.id(names.unique('$$anchor'));
		const template = [
			...separate,
			...render(context, analysis.root, inner, analysis.namespace, true)
		];
		const fn = b.arrow(
			[],
			[
				...script,
				...(deferred === null ? [] : [deferred.publish]),
				{ type: 'ReturnStatement', argument: b.arrow([inner], [...context.instance, ...template]) }
			]
		);
		body.push(b.statement(runtime(context, 'script', anchor, { ...fn, async: true })));
	} else {
		const template = render(context, analysis.root, anchor, analysis.namespace, true);
		body.push(...script, ...context.instance, ...separate, ...template);
	}
	body.push({
		type: 'ReturnStatement',
		argument: runtime(
			context,
			'pop',
			...(exposed.length > 0
				? [
						{
							type: 'ObjectExpression',
							properties: deferred?.properties ?? exposed
						} as ES.ObjectExpression
					]
				: [])
		)
	});
	const trailer: ES.Statement[] = [];
	if (context.events.size > 0) {
		trailer.push(
			b.statement(
				runtime(context, 'delegate', ...[...context.events].map((type) => b.literal(type)))
			)
		);
	}
	trailer.push(...customElement(context, options.name, exported, options.hmr));
	const hash = options.scoping.hash === '' ? null : options.scoping.hash;
	return b.program([
		b.namespaceImport(id.name, options.runtime),
		...imports,
		...level,
		...context.hoisted,
		...(options.hmr
			? hotComponent(id, options.name, [anchor, props], body, hash)
			: [b.exportDefaultFunction(options.name, [anchor, props], body)]),
		...trailer
	]);
}

export function clientModule(analysis: ModuleAnalysis, options: ModuleOptions): ES.Program {
	const names = new b.Names(analysis.names);
	const id = b.id(names.unique('$'));
	const context: Context = {
		analysis,
		names,
		runtime: id,
		runtimeNames: options.runtimeNames,
		plain: new Set(),
		hoisted: [],
		props: null,
		filename: analysis.unit.filename ?? '(unknown)',
		dev: options.dev
	};
	traceStacks(context);
	const body = analysis.unit.program.body.map((statement) => rewrite(context, statement));
	return b.program([b.namespaceImport(id.name, options.runtime), ...context.hoisted, ...body]);
}
