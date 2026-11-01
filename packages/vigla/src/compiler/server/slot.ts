import * as b from '../ir/estree.ts';
import type * as ES from 'estree';
import { open, close } from '../../shared/markers.ts';
import type { Slot } from '../ir/nodes.ts';
import { rewrite } from './script.ts';
import { Buffer, cleaned, fragmentCode, valueOf, type TemplateContext } from './template.ts';

export function slot(
	context: TemplateContext,
	node: Slot,
	statements: ES.Statement[],
	buffer: Buffer
): void {
	buffer.text(open);
	buffer.flush(context, statements);
	const out = b.id(context.names.unique('$$out'));
	const inner = { ...context, out };
	const fallback: ES.Statement[] = [];
	const content = new Buffer();
	fragmentCode(inner, cleaned(context, node.fallback), fallback, content, true);
	content.flush(inner, fallback);
	const name = node.name === null || node.name === 'default' ? 'children' : node.name;
	const snippet: ES.MemberExpression = {
		type: 'MemberExpression',
		object: context.props!,
		property: b.literal(name),
		computed: true,
		optional: false
	};
	const values: ES.ObjectExpression = { type: 'ObjectExpression', properties: [] };
	for (const attribute of node.attributes) {
		if (attribute.kind === 'spread')
			values.properties.push({
				type: 'SpreadElement',
				argument: rewrite(context, attribute.expression)
			});
		else if (
			attribute.kind === 'attribute' &&
			attribute.name !== 'name' &&
			attribute.name !== 'slot'
		) {
			values.properties.push(
				...b.object({ [attribute.name]: valueOf(context, attribute.value) }).properties
			);
		}
	}
	statements.push(
		b.statement(b.call(b.logical('??', snippet, b.arrow([out], fallback)), context.out, values))
	);
	buffer.text(close);
}
