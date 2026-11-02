import type * as ES from 'estree';
import type { ExpressionProjection, Unit } from 'vigla/compiler';

type Source = Record<string, unknown>;

function record(value: unknown): value is Source {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function property(node: ES.MemberExpression): string | null {
	if (!node.computed && node.property.type === 'Identifier') return node.property.name;
	return node.computed &&
		node.property.type === 'Literal' &&
		typeof node.property.value === 'string'
		? node.property.value
		: null;
}

function primitive(node: ES.Expression): boolean {
	return (
		node.type === 'Literal' ||
		node.type === 'TemplateLiteral' ||
		node.type === 'UnaryExpression' ||
		node.type === 'BinaryExpression'
	);
}

function optional(node: ES.Expression | ES.Super): boolean {
	if (node.type === 'ChainExpression') return true;
	if (node.type === 'MemberExpression') return node.optional || optional(node.object);
	if (node.type === 'CallExpression') return node.optional || optional(node.callee);
	return false;
}

function literal(value: string, loc?: ES.SourceLocation | null): ES.Literal {
	return { type: 'Literal', value, loc };
}

function call(callee: ES.Expression, ...args: ES.Expression[]): ES.SimpleCallExpression {
	return { type: 'CallExpression', callee, arguments: args, optional: false };
}

function helper(runtime: ES.Identifier, name: string): ES.MemberExpression {
	return {
		type: 'MemberExpression',
		object: runtime,
		property: { type: 'Identifier', name },
		computed: false,
		optional: false
	};
}

export function proxyDiagnostics(unit: Unit, filename: string): ExpressionProjection {
	const searches = new WeakSet<object>();
	const assignments = new WeakMap<object, string>();
	const visit = (value: unknown, path: Source[]): void => {
		if (Array.isArray(value)) {
			for (const child of value) visit(child, path);
			return;
		}
		if (!record(value)) return;
		const parent = path.at(-1);
		if (value.type === 'CallExpression') {
			const node = value as unknown as ES.SimpleCallExpression;
			const callee = node.callee;
			if (
				callee.type === 'MemberExpression' &&
				!callee.optional &&
				!node.optional &&
				callee.object.type !== 'Super' &&
				!optional(callee.object) &&
				['includes', 'indexOf', 'lastIndexOf'].includes(property(callee) ?? '')
			) {
				searches.add(node);
			}
		}
		if (value.type === 'AssignmentExpression') {
			const node = value as unknown as ES.AssignmentExpression;
			const left = node.left;
			const event =
				parent?.type === 'ArrowFunctionExpression' &&
				path.some((ancestor) => {
					if (
						ancestor.kind !== 'attribute' ||
						typeof ancestor.name !== 'string' ||
						!ancestor.name.startsWith('on')
					)
						return false;
					const value = ancestor.value;
					return record(value) && value.expression === parent;
				});
			if (
				left.type === 'MemberExpression' &&
				left.object.type !== 'Super' &&
				left.property.type !== 'PrivateIdentifier' &&
				['=', '&&=', '||=', '??='].includes(node.operator) &&
				parent?.type !== 'ExpressionStatement' &&
				!event &&
				!path.some((ancestor) => ancestor.kind === 'binding') &&
				!primitive(node.right)
			) {
				const position = left.loc?.start;
				assignments.set(node, `${filename}:${position?.line ?? 0}:${position?.column ?? 0}`);
			}
		}
		for (const [key, child] of Object.entries(value)) {
			if (key !== 'loc' && key !== 'leadingComments' && key !== 'trailingComments')
				visit(child, [...path, value]);
		}
	};
	visit(unit, []);
	return ({ original, lowered, runtime }) => {
		if (
			searches.has(original) &&
			lowered.type === 'CallExpression' &&
			lowered.callee.type === 'MemberExpression'
		) {
			const member = lowered.callee;
			if (member.object.type === 'Super') return lowered;
			return {
				...lowered,
				callee: call(
					helper(runtime, 'search'),
					member.object,
					literal(property(member)!, member.property.loc)
				)
			};
		}
		const location = assignments.get(original);
		if (
			location !== undefined &&
			lowered.type === 'AssignmentExpression' &&
			lowered.left.type === 'MemberExpression'
		) {
			const member = lowered.left;
			if (member.object.type === 'Super' || member.property.type === 'PrivateIdentifier')
				return lowered;
			const key = member.computed
				? member.property
				: literal((member.property as ES.Identifier).name, member.property.loc);
			return {
				...lowered,
				left: {
					type: 'MemberExpression',
					object: call(helper(runtime, 'assignmentTarget'), member.object, key, literal(location)),
					property: { type: 'Identifier', name: 'current' },
					computed: false,
					optional: false
				}
			};
		}
		return lowered;
	};
}
