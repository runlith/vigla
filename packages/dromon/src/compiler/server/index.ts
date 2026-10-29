import type * as ES from 'estree';
import {
	spanOf,
	unsupported,
	type ComponentAnalysis,
	type ModuleAnalysis
} from '../analysis/index.ts';
import * as b from '../ir/estree.ts';
import { rewrite, runtime, type Context } from './script.ts';
import { Buffer, fragmentCode, type TemplateContext } from './template.ts';

export interface ModuleOptions {
	readonly runtime: string;
}

export interface ServerOptions extends ModuleOptions {
	readonly name: string;
}

export function server(analysis: ComponentAnalysis, options: ServerOptions): ES.Program {
	const names = new b.Names(analysis.names);
	const id = b.id(names.unique('$'));
	const out = b.id(names.unique('$$out'));
	const props = b.id(names.unique('$$props'));
	const context: TemplateContext = {
		analysis,
		component: analysis,
		names,
		runtime: id,
		out,
		props
	};
	const imports: ES.ImportDeclaration[] = [];
	const body: ES.Statement[] = [b.statement(runtime(context, 'push'))];
	for (const statement of analysis.unit.instance?.body ?? []) {
		if (statement.type === 'ImportDeclaration') imports.push(statement);
		else if (statement.type.startsWith('Export'))
			throw unsupported(spanOf(statement), 'An export from a component');
		else body.push(rewrite(context, statement as ES.Statement));
	}
	const buffer = new Buffer();
	fragmentCode(context, analysis.root, body, buffer, true);
	buffer.flush(context, body);
	body.push(b.statement(runtime(context, 'pop')));
	return b.program([
		b.namespaceImport(id.name, options.runtime),
		...imports,
		b.exportDefaultFunction(options.name, [out, props], body)
	]);
}

export function serverModule(analysis: ModuleAnalysis, options: ModuleOptions): ES.Program {
	const names = new b.Names(analysis.names);
	const context: Context = {
		analysis,
		names,
		runtime: b.id(names.unique('$')),
		props: null,
		out: null
	};
	const body = analysis.unit.program.body.map((statement) => rewrite(context, statement));
	return b.program([b.namespaceImport(context.runtime.name, options.runtime), ...body]);
}
