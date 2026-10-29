import type * as ES from 'estree';

const ignored = new Set([
	'type',
	'loc',
	'range',
	'start',
	'end',
	'leadingComments',
	'trailingComments'
]);

function isNode(value: unknown): value is ES.Node {
	return typeof value === 'object' && value !== null && typeof (value as ES.Node).type === 'string';
}

export class Names {
	readonly #used: Set<string>;

	constructor(used: ReadonlySet<string>) {
		this.#used = new Set(used);
	}

	unique(base: string): string {
		let name = base;
		for (let suffix = 1; this.#used.has(name); suffix++) name = `${base}_${suffix}`;
		this.#used.add(name);
		return name;
	}
}

export function children(node: ES.Node, each: (child: ES.Node) => void): void {
	for (const key of Object.keys(node)) {
		if (ignored.has(key)) continue;
		const value = (node as unknown as Record<string, unknown>)[key];
		if (Array.isArray(value)) {
			for (const item of value) if (isNode(item)) each(item);
		} else if (isNode(value)) {
			each(value);
		}
	}
}

export type Enter = (node: ES.Node, parent: ES.Node | null) => boolean | void;

export function walk(node: ES.Node, enter: Enter, parent: ES.Node | null = null): void {
	if (enter(node, parent) === false) return;
	children(node, (child) => walk(child, enter, node));
}

export type Rewrite = (
	node: ES.Node,
	next: <T extends ES.Node>(node: T) => T
) => ES.Node | undefined;

export function rewrite<T extends ES.Node>(node: T, visit: Rewrite): T {
	const next = <N extends ES.Node>(child: N): N => rewrite(child, visit);
	const replaced = visit(node, next);
	if (replaced !== undefined) return replaced as T;
	let copy: Record<string, unknown> | null = null;
	const source = node as unknown as Record<string, unknown>;
	for (const key of Object.keys(node)) {
		if (ignored.has(key)) continue;
		const value = source[key];
		let mapped: unknown = value;
		if (Array.isArray(value)) {
			let changed = false;
			const items = value.map((item: unknown) => {
				if (!isNode(item)) return item;
				const result = next(item);
				if (result !== item) changed = true;
				return result;
			});
			if (changed) mapped = items;
		} else if (isNode(value)) {
			mapped = next(value);
		}
		if (mapped !== value) {
			copy ??= { ...source };
			copy[key] = mapped;
		}
	}
	return (copy ?? node) as T;
}

export function id(name: string): ES.Identifier {
	return { type: 'Identifier', name };
}

export function literal(value: string | number | boolean | null): ES.Literal {
	return { type: 'Literal', value };
}

export function member(object: ES.Expression, property: string): ES.MemberExpression {
	return {
		type: 'MemberExpression',
		object,
		property: id(property),
		computed: false,
		optional: false
	};
}

export function call(
	callee: ES.Expression,
	...args: readonly (ES.Expression | ES.SpreadElement)[]
): ES.SimpleCallExpression {
	return { type: 'CallExpression', callee, arguments: [...args], optional: false };
}

export function arrow(
	params: readonly ES.Pattern[],
	body: ES.Expression | readonly ES.Statement[]
): ES.ArrowFunctionExpression {
	const block = Array.isArray(body);
	return {
		type: 'ArrowFunctionExpression',
		params: [...params],
		body: block
			? { type: 'BlockStatement', body: [...(body as readonly ES.Statement[])] }
			: (body as ES.Expression),
		expression: !block,
		async: false,
		generator: false
	};
}

export function conditional(
	test: ES.Expression,
	consequent: ES.Expression,
	alternate: ES.Expression
): ES.ConditionalExpression {
	return { type: 'ConditionalExpression', test, consequent, alternate };
}

export function logical(
	operator: ES.LogicalOperator,
	left: ES.Expression,
	right: ES.Expression
): ES.LogicalExpression {
	return { type: 'LogicalExpression', operator, left, right };
}

export function binary(
	operator: ES.BinaryOperator,
	left: ES.Expression,
	right: ES.Expression
): ES.BinaryExpression {
	return { type: 'BinaryExpression', operator, left, right };
}

export function template(
	quasis: readonly string[],
	expressions: readonly ES.Expression[]
): ES.TemplateLiteral {
	return {
		type: 'TemplateLiteral',
		quasis: quasis.map((raw, index) => ({
			type: 'TemplateElement',
			value: { raw: raw.replace(/[\\`]|\$\{/g, (match) => `\\${match}`), cooked: raw },
			tail: index === quasis.length - 1
		})),
		expressions: [...expressions]
	};
}

export function statement(expression: ES.Expression): ES.ExpressionStatement {
	return { type: 'ExpressionStatement', expression };
}

export function constant(name: string, init: ES.Expression): ES.VariableDeclaration {
	return {
		type: 'VariableDeclaration',
		kind: 'const',
		declarations: [{ type: 'VariableDeclarator', id: id(name), init }]
	};
}

export function namespaceImport(local: string, source: string): ES.ImportDeclaration {
	return {
		type: 'ImportDeclaration',
		specifiers: [{ type: 'ImportNamespaceSpecifier', local: id(local) }],
		source: literal(source) as ES.Literal & { value: string },
		attributes: []
	};
}

export function exportDefaultFunction(
	name: string,
	params: readonly ES.Pattern[],
	body: readonly ES.Statement[]
): ES.ExportDefaultDeclaration {
	return {
		type: 'ExportDefaultDeclaration',
		declaration: {
			type: 'FunctionDeclaration',
			id: id(name),
			params: [...params],
			body: { type: 'BlockStatement', body: [...body] },
			async: false,
			generator: false
		}
	};
}

export function program(body: readonly (ES.Statement | ES.ModuleDeclaration)[]): ES.Program {
	return { type: 'Program', sourceType: 'module', body: [...body] };
}
