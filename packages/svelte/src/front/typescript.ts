import { fail } from './diagnostics.ts';

type Node = { type: string; [key: string]: unknown };

const erasedStatements = new WeakSet<Node>();

const empty = (): Node => {
	const statement: Node = { type: 'EmptyStatement' };
	erasedStatements.add(statement);
	return statement;
};

const unwrapped = new Set([
	'TSAsExpression',
	'TSSatisfiesExpression',
	'TSNonNullExpression',
	'TSTypeAssertion',
	'TSInstantiationExpression'
]);

const erased = new Set(['TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSDeclareFunction']);

const typeFields = [
	'typeAnnotation',
	'typeParameters',
	'typeArguments',
	'returnType',
	'accessibility',
	'readonly',
	'definite',
	'override'
];

function isNode(value: unknown): value is Node {
	return value !== null && typeof value === 'object' && typeof (value as Node).type === 'string';
}

class Stripper {
	readonly path: Node[] = [];

	children(node: Node): void {
		this.path.push(node);
		for (const key in node) {
			if (key === 'type') continue;
			const value = node[key];
			if (Array.isArray(value)) {
				for (let index = 0; index < value.length; index++) {
					if (isNode(value[index])) value[index] = this.visit(value[index] as Node);
				}
			} else if (isNode(value)) {
				node[key] = this.visit(value);
			}
		}
		this.path.pop();
	}

	clean(node: Node): Node {
		for (const field of typeFields) delete node[field];
		if (node.type !== 'MemberExpression' && node.type !== 'CallExpression') delete node.optional;
		return node;
	}

	visit(node: Node): Node {
		return this.clean(this.special(node));
	}

	special(node: Node): Node {
		if (unwrapped.has(node.type)) return this.visit(node.expression as Node);
		if (erased.has(node.type)) return empty();
		switch (node.type) {
			case 'Decorator':
				fail('typescript_invalid_feature', node as never, {
					feature: 'decorators (related TSC proposal is not stage 4 yet)'
				});
			case 'TSEnumDeclaration':
				fail('typescript_invalid_feature', node as never, { feature: 'enums' });
			case 'ImportDeclaration': {
				if (node.importKind === 'type') return empty();
				const specifiers = node.specifiers as Node[] | undefined;
				if (specifiers !== undefined && specifiers.length > 0) {
					const kept = specifiers.filter((specifier) => specifier.importKind !== 'type');
					if (kept.length === 0) return empty();
					node.specifiers = kept;
				}
				return node;
			}
			case 'ExportNamedDeclaration': {
				if (node.exportKind === 'type') return empty();
				if (node.declaration) {
					this.children(node);
					return (node.declaration as Node).type === 'EmptyStatement' ? empty() : node;
				}
				const specifiers = node.specifiers as Node[] | undefined;
				if (specifiers) {
					const kept = specifiers.filter((specifier) => specifier.exportKind !== 'type');
					if (kept.length === 0) return empty();
					node.specifiers = kept;
				}
				return node;
			}
			case 'ExportDefaultDeclaration':
			case 'ExportAllDeclaration':
				return node.exportKind === 'type' ? empty() : node;
			case 'PropertyDefinition':
				if (node.accessor) {
					fail('typescript_invalid_feature', node as never, {
						feature: 'accessor fields (related TSC proposal is not stage 4 yet)'
					});
				}
				break;
			case 'TSParameterProperty': {
				if ((node.readonly || node.accessibility) && this.path.at(-2)?.kind === 'constructor') {
					fail('typescript_invalid_feature', node as never, {
						feature: 'accessibility modifiers on constructor parameters'
					});
				}
				return this.visit(node.parameter as Node);
			}
			case 'FunctionExpression':
			case 'FunctionDeclaration': {
				const params = node.params as Node[];
				const first = params[0];
				if (first?.type === 'Identifier' && first.name === 'this') params.shift();
				break;
			}
			case 'ClassBody': {
				const body: Node[] = [];
				this.path.push(node);
				for (const member of node.body as Node[]) {
					const child = this.visit(member);
					if (child.type !== 'PropertyDefinition' || !child.declare) body.push(child);
				}
				this.path.pop();
				node.body = body;
				return node;
			}
			case 'ClassDeclaration':
				if (node.declare) return empty();
				delete node.abstract;
				delete node.implements;
				delete node.superTypeArguments;
				delete node.superTypeParameters;
				break;
			case 'ClassExpression':
				delete node.implements;
				delete node.superTypeArguments;
				delete node.superTypeParameters;
				break;
			case 'MethodDefinition':
				if (node.abstract) return empty();
				break;
			case 'VariableDeclaration':
				if (node.declare) return empty();
				break;
			case 'TSModuleDeclaration': {
				const body = node.body as Node | undefined;
				if (!body) return empty();
				this.path.push(node);
				const cleaned = (body.body as Node[]).map((entry) => this.visit(entry));
				this.path.pop();
				if (cleaned.some((entry) => !erasedStatements.has(entry))) {
					fail('typescript_invalid_feature', node as never, {
						feature: 'namespaces with non-type nodes'
					});
				}
				return empty();
			}
			default:
				break;
		}
		this.children(node);
		return node;
	}
}

export function stripTypes<T>(node: T): T {
	return new Stripper().visit(node as unknown as Node) as unknown as T;
}
