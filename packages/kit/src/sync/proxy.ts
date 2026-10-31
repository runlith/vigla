import { readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { parseSync, type ESTree } from 'vite';
import { importPath, writeChanged } from './files.ts';

export interface TypeProxy {
	exports: Set<string>;
	module: string;
	file?: string;
}
interface Change {
	start: number;
	end: number;
	text: string;
}
type FunctionNode = ESTree.Function | ESTree.ArrowFunctionExpression;

function isFunction(node: ESTree.Expression | ESTree.Declaration | null): node is FunctionNode {
	return (
		node?.type === 'ArrowFunctionExpression' ||
		node?.type === 'FunctionExpression' ||
		node?.type === 'FunctionDeclaration'
	);
}
function bindings(pattern: ESTree.BindingPattern | ESTree.BindingRestElement): string[] {
	if (pattern.type === 'Identifier') return [pattern.name];
	if (pattern.type === 'AssignmentPattern') return bindings(pattern.left);
	if (pattern.type === 'RestElement') return bindings(pattern.argument);
	if (pattern.type === 'ArrayPattern')
		return pattern.elements.flatMap((item) => (item ? bindings(item) : []));
	if (pattern.type === 'ObjectPattern')
		return pattern.properties.flatMap((property) =>
			bindings(property.type === 'RestElement' ? property.argument : property.value)
		);
	return [];
}

export function createProxy(file: string, root: string, output: string): TypeProxy | null {
	const original = readFileSync(join(root, file), 'utf8');
	const absolute = join(root, file);
	const parsed = parseSync(absolute, original, { sourceType: 'module' });
	if (parsed.errors.length) return null;
	const exports = new Map<string, string>();
	for (const statement of parsed.program.body) {
		if (statement.type !== 'ExportNamedDeclaration') continue;
		for (const specifier of statement.specifiers) {
			const exported =
				specifier.exported.type === 'Identifier'
					? specifier.exported.name
					: String(specifier.exported.value);
			const local =
				specifier.local.type === 'Identifier'
					? specifier.local.name
					: String(specifier.local.value);
			exports.set(exported, local);
		}
		const declaration = statement.declaration;
		if (declaration?.type === 'VariableDeclaration')
			for (const variable of declaration.declarations)
				for (const name of bindings(variable.id)) exports.set(name, name);
		if (declaration?.type === 'FunctionDeclaration' && declaration.id)
			exports.set(declaration.id.name, declaration.id.name);
	}
	const targets = new Set([exports.get('load'), exports.get('actions')]);
	const edits: Change[] = [];
	const parameter = (fn: FunctionNode, type: string): boolean => {
		const first = fn.params[0];
		if (!first) return false;
		const value = first.type === 'AssignmentPattern' ? first.left : first;
		if ('typeAnnotation' in value && value.typeAnnotation) return false;
		const bare =
			fn.type === 'ArrowFunctionExpression' && original.slice(fn.start, first.start).trim() === '';
		if (bare) edits.push({ start: first.start, end: first.start, text: '(' });
		edits.push({ start: value.end, end: value.end, text: `: ${type}${bare ? ')' : ''}` });
		return true;
	};
	const docType = (start: number, fn: FunctionNode | null): string | null => {
		const comment = parsed.comments
			.filter((comment) => comment.end <= start && /^\s*$/.test(original.slice(comment.end, start)))
			.at(-1);
		if (!comment) return null;
		const text = original.slice(comment.start, comment.end);
		const at = text.indexOf('@type');
		if (at < 0) return null;
		const begin = text.indexOf('{', at);
		let depth = 1;
		let end = begin + 1;
		while (end < text.length && depth) {
			if (text[end] === '{') depth++;
			if (text[end] === '}') depth--;
			end++;
		}
		if (depth || begin < 0) return null;
		const type = text.slice(begin + 1, end - 1);
		const first = fn?.params[0];
		const name = first?.type === 'Identifier' ? first.name : 'event';
		edits.push({
			start: comment.start,
			end: comment.end,
			text: first ? `/** @param {Parameters<${type}>[0]} ${name} */` : ''
		});
		return type;
	};
	let unused = '';
	for (const statement of parsed.program.body) {
		const declaration =
			statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
		if (
			declaration?.type === 'FunctionDeclaration' &&
			declaration.id &&
			declaration.id.name === exports.get('load')
		)
			docType(statement.start, declaration);
		if (declaration?.type !== 'VariableDeclaration') continue;
		for (const variable of declaration.declarations) {
			if (variable.id.type !== 'Identifier' || !targets.has(variable.id.name)) continue;
			const annotation = variable.id.typeAnnotation;
			const init = variable.init;
			const action = variable.id.name === exports.get('actions');
			const type = annotation
				? original.slice(annotation.typeAnnotation.start, annotation.typeAnnotation.end)
				: null;
			if (annotation) edits.push({ start: annotation.start, end: annotation.end, text: '' });
			const doc = docType(statement.start, !action && isFunction(init) ? init : null);
			if (!action && type && isFunction(init) && !parameter(init, `Parameters<${type}>[0]`))
				unused += `;null as unknown as ${type};`;
			if (action && (type || doc) && init?.type === 'ObjectExpression') {
				for (const property of init.properties) {
					if (property.type !== 'Property' || !isFunction(property.value)) continue;
					if (type) parameter(property.value, "import('./$types').RequestEvent");
					else if (!docType(property.start, property.value) && property.value.params.length) {
						const first = property.value.params[0]!;
						const name = first.type === 'Identifier' ? first.name : 'event';
						edits.push({
							start: property.value.start,
							end: property.value.start,
							text: `/** @param {import('./$types').RequestEvent} ${name} */ `
						});
					}
				}
				if (type) unused += `;null as unknown as ${type};`;
			}
		}
	}
	if (!edits.length)
		return { exports: new Set(exports.keys()), module: importPath(output, absolute) };
	for (const statement of parsed.program.body) {
		const source =
			statement.type === 'ImportDeclaration' ||
			statement.type === 'ExportNamedDeclaration' ||
			statement.type === 'ExportAllDeclaration'
				? statement.source
				: null;
		if (
			source &&
			typeof source.value === 'string' &&
			source.value.startsWith('.') &&
			!source.value.includes('$types')
		)
			edits.push({
				start: source.start,
				end: source.end,
				text: JSON.stringify(importPath(output, resolve(dirname(absolute), source.value)))
			});
	}
	let code = original;
	for (const edit of edits.sort((a, b) => b.start - a.start || b.end - a.end))
		code = code.slice(0, edit.start) + edit.text + code.slice(edit.end);
	code += unused;
	if (code.startsWith('// @ts-check'))
		code = code.replace('// @ts-check', '// @ts-check\n// @ts-nocheck');
	else code = '// @ts-nocheck\n' + code;
	const name = 'proxy' + basename(file);
	writeChanged(join(output, name), code);
	return {
		exports: new Set(exports.keys()),
		module: './' + name.replace(/\.(?:ts|mts|cts)$/, '.js'),
		file: join(output, name)
	};
}
