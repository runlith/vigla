import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSync, type ESTree } from 'vite';
import type { PageNode, PageOptions } from '../types/internal/routes.ts';

const names = new Set(['ssr', 'csr', 'prerender', 'trailingSlash', 'config', 'entries', 'load']);
function exportName(node: ESTree.ModuleExportName): string {
	return node.type === 'Identifier' ? node.name : String(node.value);
}

export function analyseOptions(filename: string, source: string): PageOptions | null {
	if (!/ssr|csr|prerender|trailingSlash|config|entries|load|export\s+\*\s+from/.test(source))
		return {};
	try {
		const parsed = parseSync(filename, source, { sourceType: 'module' });
		if (parsed.errors.length) throw new Error(parsed.errors[0]!.message);
		const bindings = new Map<string, ESTree.VariableDeclarator | ESTree.Declaration>();
		const exports = new Map<string, string>();
		for (const statement of parsed.program.body) {
			if (statement.type === 'ExportDefaultDeclaration') return null;
			if (statement.type === 'ExportAllDeclaration') {
				if (!statement.exported || names.has(exportName(statement.exported))) return null;
				continue;
			}
			if (statement.type === 'ExportNamedDeclaration') {
				for (const specifier of statement.specifiers) {
					const name = exportName(specifier.exported);
					if (!names.has(name)) continue;
					if (statement.source) return null;
					exports.set(name, exportName(specifier.local));
				}
			}
			const declaration =
				statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
			if (declaration?.type === 'VariableDeclaration') {
				for (const variable of declaration.declarations) {
					if (variable.id.type !== 'Identifier') {
						if (statement.type === 'ExportNamedDeclaration') return null;
						continue;
					}
					bindings.set(variable.id.name, variable);
					if (statement.type === 'ExportNamedDeclaration' && names.has(variable.id.name))
						exports.set(variable.id.name, variable.id.name);
				}
			} else if (
				declaration?.type === 'FunctionDeclaration' ||
				declaration?.type === 'ClassDeclaration'
			) {
				if (!declaration.id) continue;
				bindings.set(declaration.id.name, declaration);
				if (statement.type === 'ExportNamedDeclaration' && names.has(declaration.id.name))
					exports.set(declaration.id.name, declaration.id.name);
			}
		}
		const result: Record<string, unknown> = {};
		for (const [name, local] of exports) {
			const declaration = bindings.get(local);
			if (!declaration) return null;
			if (
				name === 'load' &&
				local === 'load' &&
				(declaration.type === 'VariableDeclarator' || declaration.type === 'FunctionDeclaration')
			) {
				result.load = null;
				continue;
			}
			if (declaration.type !== 'VariableDeclarator' || declaration.init?.type !== 'Literal')
				return null;
			result[name] = declaration.init.value;
		}
		return result as PageOptions;
	} catch (error) {
		if (error instanceof Error)
			error.message = `Failed to statically analyse page options for ${filename}. ${error.message}`;
		throw error;
	}
}

export function readOptions(file: string, root: string): PageOptions | null {
	const source = readFileSync(resolve(root, file), 'utf8');
	try {
		return analyseOptions(file, source);
	} catch {
		return null;
	}
}

export function applyOptions(nodes: PageNode[], root: string): void {
	const visited = new Set<number>();
	const visit = (index: number): PageOptions | null => {
		const node = nodes[index]!;
		if (visited.has(index)) return node.options;
		let options: PageOptions | null = node.parent === null ? {} : visit(node.parent);
		for (const file of [node.server, node.universal]) {
			if (!file || options === null) continue;
			const own = readOptions(file, root);
			options = own === null ? null : { ...options, ...own };
		}
		node.options = options;
		visited.add(index);
		return options;
	};
	for (let index = 0; index < nodes.length; index++) visit(index);
}
