import type * as ES from 'estree';
import * as b from '../ir/estree.ts';

function hotModule(): ES.MemberExpression {
	const meta: ES.MetaProperty = {
		type: 'MetaProperty',
		meta: b.id('import'),
		property: b.id('meta')
	};
	return b.member(meta, 'hot');
}

export function hotComponent(
	runtime: ES.Identifier,
	name: string,
	params: readonly ES.Pattern[],
	body: readonly ES.Statement[],
	hash: string | null
): (ES.Statement | ES.ModuleDeclaration)[] {
	const component = b.id(name);
	const module = b.id('module');
	const record: ES.MemberExpression = {
		type: 'MemberExpression',
		object: component,
		property: b.member(runtime, 'HMR'),
		computed: true,
		optional: false
	};
	const accept: ES.Statement[] = [
		b.statement(b.call(b.member(record, 'update'), b.member(module, 'default')))
	];
	if (hash !== null) {
		accept.unshift(b.statement(b.call(b.member(runtime, 'cleanupStyles'), b.literal(hash))));
	}
	const declaration: ES.FunctionDeclaration = {
		type: 'FunctionDeclaration',
		id: component,
		params: [...params],
		body: { type: 'BlockStatement', body: [...body] },
		async: false,
		generator: false
	};
	const replace: ES.AssignmentExpression = {
		type: 'AssignmentExpression',
		operator: '=',
		left: component,
		right: b.call(b.member(runtime, 'hmr'), component)
	};
	const swap: ES.IfStatement = {
		type: 'IfStatement',
		test: hotModule(),
		consequent: {
			type: 'BlockStatement',
			body: [
				b.statement(replace),
				b.statement(b.call(b.member(hotModule(), 'accept'), b.arrow([module], accept)))
			]
		},
		alternate: null
	};
	return [declaration, swap, { type: 'ExportDefaultDeclaration', declaration: component }];
}
