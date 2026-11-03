import type * as ES from 'estree';
import type { Format } from '../../shared/format.ts';
import type { RuntimeNames } from '../ir/runtime.ts';
import {
	ignoring,
	spanOf,
	unsupported,
	type ComponentAnalysis,
	type ModuleAnalysis
} from '../analysis/index.ts';
import { close, open } from '../../shared/markers.ts';
import type { InjectedStyle, Scoping } from '../css/index.ts';
import * as b from '../ir/estree.ts';
import { inSegment, rewrite, runtime, type Context } from './script.ts';
import { prepare } from './external.ts';
import { separateCode } from './special.ts';
import { Buffer, fragmentCode, type TemplateContext } from './template.ts';

export interface ModuleOptions {
	readonly runtime: string;
	readonly runtimeNames?: RuntimeNames;
	readonly dev: boolean;
}

export interface ServerOptions extends ModuleOptions {
	readonly name: string;
	readonly format: Format;
	readonly scoping: Scoping;
	readonly styles: InjectedStyle | null;
	readonly filename: string;
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

export function server(analysis: ComponentAnalysis, options: ServerOptions): ES.Program {
	const names = new b.Names(analysis.names);
	const id = b.id(names.unique('$'));
	const out = b.id(names.unique('$$out'));
	const props = b.id(names.unique('$$props'));
	const settlement = b.id(names.unique('$$settlement'));
	const propsId = [...analysis.runes.values()].includes('$props.id')
		? b.id(names.unique('$$id'))
		: undefined;
	const context: TemplateContext = {
		analysis,
		component: analysis,
		names,
		runtime: id,
		propsId,
		runtimeNames: options.runtimeNames,
		out,
		props,
		settlement,
		scoping: options.scoping,
		format: options.format,
		hoisted: [],
		early: [],
		dev: options.dev,
		filename: options.filename,
		externalCells: new Map(),
		ignoring: ignoring(analysis.unit.ignores, analysis.ignored)
	};
	const imports: ES.ImportDeclaration[] = [];
	const hoisted = context.hoisted;
	for (const statement of analysis.unit.module?.body ?? []) {
		if (statement.type === 'ImportDeclaration') imports.push(statement);
		else hoisted.push(rewrite({ ...context, props: null, out: null }, statement as ES.Statement));
	}
	const body: ES.Statement[] = [];
	if (options.styles !== null) {
		const css = names.unique('$$css');
		const { hash, code } = options.styles;
		hoisted.push(b.constant(css, b.object({ hash: b.literal(hash), code: b.literal(code) })));
		body.push(b.statement(runtime(context, 'appendStyles', out, b.id(css))));
	}
	body.push(b.statement(runtime(context, 'push')));
	if (propsId !== undefined) body.push(b.constant(propsId.name, runtime(context, 'propsId', out)));
	const inner = analysis.asynchronous ? b.id(names.unique('$$out')) : out;
	const segment = analysis.asynchronous ? b.id(names.unique('$$segment')) : undefined;
	const scripted: TemplateContext = analysis.asynchronous
		? { ...context, out: inner, saved: topLevelAwaits(analysis), segment }
		: context;
	const script = prepare(scripted, [...new Set(analysis.externals.values())]);
	for (const statement of analysis.unit.instance?.body ?? []) {
		if (statement.type === 'ImportDeclaration') imports.push(statement);
		else if (statement.type === 'ExportNamedDeclaration' && statement.source == null) {
			if (statement.declaration != null) script.push(rewrite(scripted, statement.declaration));
		} else if (statement.type.startsWith('Export'))
			throw unsupported(spanOf(statement), 'This export from a component');
		else script.push(rewrite(scripted, statement as ES.Statement));
	}
	const template: TemplateContext = { ...context, out: inner };
	const content: ES.Statement[] = separateCode(template, analysis.unit.template);
	const buffer = new Buffer();
	if (analysis.asynchronous) buffer.text(open);
	fragmentCode(template, analysis.root, content, buffer, true);
	if (analysis.asynchronous) buffer.text(close);
	buffer.flush(template, content);
	const bindable = [...analysis.declarations.values()].filter(
		(binding) => binding.kind === 'prop' && binding.prop?.bindable
	);
	const finish =
		bindable.length === 0
			? []
			: [
					b.statement(
						runtime(
							context,
							'bindProps',
							props,
							b.object(
								Object.fromEntries(
									bindable.map((binding) => [binding.prop!.key, { ...binding.declaration! }])
								)
							)
						)
					)
				];
	const bindings = [...analysis.fragments.values()].some((nodes) =>
		nodes.some(
			(node) =>
				node.kind === 'component' &&
				node.attributes.some(
					(attribute) =>
						attribute.kind === 'binding' &&
						attribute.name !== 'this' &&
						attribute.expression.type !== 'SequenceExpression'
				)
		)
	);
	const declarations = content.filter((statement) => statement.type === 'FunctionDeclaration');
	const repeated = content.filter((statement) => statement.type !== 'FunctionDeclaration');
	const stabilized = bindings || finish.length > 0;
	const rendered = stabilized
		? [
				b.statement(
					b.call(
						b.member(inner, 'stabilize'),
						settlement,
						b.arrow([inner], repeated),
						...(finish.length === 0 ? [] : [b.arrow([], finish)])
					)
				)
			]
		: repeated;
	const setup = stabilized
		? [
				b.constant(settlement.name, {
					type: 'NewExpression',
					callee: b.member(id, options.runtimeNames?.Settlement ?? 'Settlement'),
					arguments: []
				})
			]
		: [];
	const instance = [...setup, ...declarations, ...context.early, ...script, ...rendered];
	if (segment !== undefined) {
		const fn = { ...b.arrow([inner], inSegment(context, segment, instance)), async: true };
		body.push(b.statement(b.call(b.member(out, 'child'), fn)));
	} else {
		body.push(...instance);
	}
	body.push(b.statement(runtime(context, 'pop')));
	return b.program([
		b.namespaceImport(id.name, options.runtime),
		...imports,
		...hoisted,
		b.exportDefaultFunction(options.name, [out, props], body)
	]);
}

export function serverModule(analysis: ModuleAnalysis, options: ModuleOptions): ES.Program {
	const names = new b.Names(analysis.names);
	const context: Context = {
		analysis,
		names,
		runtime: b.id(names.unique('$')),
		runtimeNames: options.runtimeNames,
		props: null,
		out: null,
		dev: options.dev,
		ignoring: ignoring(analysis.unit.ignores)
	};
	const body = analysis.unit.program.body.map((statement) => rewrite(context, statement));
	return b.program([b.namespaceImport(context.runtime.name, options.runtime), ...body]);
}
