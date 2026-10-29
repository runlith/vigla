import type * as ES from 'estree';
import {
	spanOf,
	unsupported,
	type ComponentAnalysis,
	type ModuleAnalysis
} from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import { rewrite, type Context } from './script.ts';
import { render, type TemplateContext } from './template.ts';

export interface ModuleOptions {
	readonly runtime: string;
}

export interface ClientOptions extends ModuleOptions {
	readonly name: string;
}

export function client(analysis: ComponentAnalysis, options: ClientOptions): ES.Program {
	const names = new b.Names(analysis.names);
	const runtime = b.id(names.unique('$'));
	const anchor = b.id(names.unique('$$anchor'));
	const props = b.id(names.unique('$$props'));
	const context: TemplateContext = {
		analysis,
		component: analysis,
		names,
		runtime,
		plain: new Set(),
		hoisted: []
	};
	const imports: ES.ImportDeclaration[] = [];
	const body: ES.Statement[] = [];
	for (const statement of analysis.unit.instance?.body ?? []) {
		if (statement.type === 'ImportDeclaration') imports.push(statement);
		else if (statement.type.startsWith('Export'))
			throw unsupported(spanOf(statement), 'An export from a component');
		else body.push(rewrite(context, statement as ES.Statement));
	}
	body.push(...render(context, analysis.root, anchor));
	return b.program([
		b.namespaceImport(runtime.name, options.runtime),
		...imports,
		...context.hoisted,
		b.exportDefaultFunction(options.name, [anchor, props], body)
	]);
}

export function clientModule(analysis: ModuleAnalysis, options: ModuleOptions): ES.Program {
	const names = new b.Names(analysis.names);
	const runtime = b.id(names.unique('$'));
	const context: Context = { analysis, names, runtime, plain: new Set(), hoisted: [] };
	const body = analysis.unit.program.body.map((statement) => rewrite(context, statement));
	return b.program([b.namespaceImport(runtime.name, options.runtime), ...context.hoisted, ...body]);
}
