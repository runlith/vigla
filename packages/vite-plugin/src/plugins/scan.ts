import fs from 'node:fs/promises';
import type { Rolldown } from 'vite';
import type { Compiler, Parse, ParsedComponent, Script } from '../compiler.ts';
import type { FrontEnd } from '../front-end.ts';

interface Node {
	readonly type: string;
	readonly [key: string]: unknown;
}

interface Part {
	module: boolean;
	lang: 'js' | 'ts';
	code: string;
}

const partId = /\?scan=(\d+)&lang\.[jt]s$/;

export function scanning(input: Rolldown.InputOptions): boolean {
	const plugins = (input.plugins ?? []) as { name?: string }[];
	return plugins.some((entry) => entry?.name === 'vite:dep-scan:resolve');
}

function node(value: unknown): Node | undefined {
	return value !== null && typeof value === 'object' && typeof (value as Node).type === 'string'
		? (value as Node)
		: undefined;
}

function nodes(value: unknown): Node[] {
	return Array.isArray(value) ? value.flatMap((item) => node(item) ?? []) : [];
}

function identifier(value: unknown): string | undefined {
	const found = node(value);
	return found?.type === 'Identifier' ? (found.name as string) : undefined;
}

function bind(pattern: Node | undefined, names: Set<string>): void {
	if (pattern === undefined) return;
	if (pattern.type === 'Identifier') names.add(pattern.name as string);
	else if (pattern.type === 'ObjectPattern') {
		for (const property of nodes(pattern.properties))
			bind(node(property.type === 'RestElement' ? property.argument : property.value), names);
	} else if (pattern.type === 'ArrayPattern') {
		for (const element of nodes(pattern.elements)) bind(element, names);
	} else if (pattern.type === 'RestElement') bind(node(pattern.argument), names);
	else if (pattern.type === 'AssignmentPattern') bind(node(pattern.left), names);
}

function declared(body: readonly Node[]): Set<string> {
	const names = new Set<string>();
	for (const statement of body) {
		const declaration = statement.type.startsWith('Export')
			? node(statement.declaration)
			: statement;
		if (declaration === undefined) continue;
		if (declaration.type === 'ImportDeclaration') {
			for (const specifier of nodes(declaration.specifiers)) bind(node(specifier.local), names);
		} else if (declaration.type === 'VariableDeclaration') {
			for (const declarator of nodes(declaration.declarations)) bind(node(declarator.id), names);
		} else {
			const name = identifier(declaration.id);
			if (name !== undefined) names.add(name);
		}
	}
	return names;
}

function undeclaredExports(body: readonly Node[]): Set<string> {
	const names = declared(body);
	const missing = new Set<string>();
	for (const statement of body) {
		if (statement.type !== 'ExportNamedDeclaration' || statement.source) continue;
		if (statement.exportKind === 'type') continue;
		for (const specifier of nodes(statement.specifiers)) {
			const local = identifier(specifier.local);
			if (local !== undefined && specifier.exportKind !== 'type' && !names.has(local))
				missing.add(local);
		}
	}
	return missing;
}

function importedSources(body: readonly Node[]): string[] {
	return body.flatMap((statement) =>
		statement.type === 'ImportDeclaration' && statement.importKind !== 'type'
			? [String(node(statement.source)?.value)]
			: []
	);
}

function language(script: Script): 'js' | 'ts' | undefined {
	let lang = 'js';
	for (const attribute of script.attributes) {
		if (attribute.name === 'src') return undefined;
		if (attribute.name !== 'lang') continue;
		if (!Array.isArray(attribute.value)) return undefined;
		lang = (attribute.value as readonly { data?: string }[])
			.map((part) => part.data ?? '')
			.join('');
	}
	if (lang === 'js' || lang === 'javascript') return 'js';
	if (lang === 'ts' || lang === 'typescript') return 'ts';
	return undefined;
}

async function parse(
	compiler: Compiler,
	parser: Parse,
	filename: string
): Promise<{ source: string; parsed: ParsedComponent }> {
	const source = (await fs.readFile(filename, 'utf8')).replace(/^﻿/, '');
	try {
		return { source, parsed: parser(source, { modern: true, filename }) };
	} catch {
		const blank = await compiler.preprocess(source, { style: () => ({ code: '' }) }, { filename });
		return { source: blank.code, parsed: parser(blank.code, { modern: true, filename }) };
	}
}

async function split(compiler: Compiler, filename: string): Promise<Part[] | undefined> {
	if (compiler.parse === undefined) return undefined;
	try {
		const { source, parsed } = await parse(compiler, compiler.parse, filename);
		const parts: Part[] = [];
		for (const [script, module] of [
			[parsed.module, true],
			[parsed.instance, false]
		] as const) {
			if (!script) continue;
			const lang = language(script);
			if (lang === undefined) return undefined;
			const body = nodes(script.content.body);
			let code = source.slice(script.content.start, script.content.end);
			for (const local of undeclaredExports(body)) code += `\nvar ${local};`;
			if (lang === 'ts') {
				for (const imported of importedSources(body))
					code += `\nimport ${JSON.stringify(imported)};`;
			}
			parts.push({ module, lang, code });
		}
		return parts;
	} catch {
		return undefined;
	}
}

function facade(filename: string, parts: readonly Part[]): string {
	let code = '';
	for (const [index, part] of parts.entries()) {
		const specifier = JSON.stringify(`${filename}?scan=${index}&lang.${part.lang}`);
		code += part.module ? `export * from ${specifier};\n` : `import ${specifier};\n`;
	}
	return `${code}export default {};\n`;
}

function escape(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scanner(name: string, parsing: readonly FrontEnd[]): Rolldown.Plugin {
	const extensions = parsing.flatMap((frontEnd) => frontEnd.components).map(escape);
	const component = new RegExp(`^[^?#]+(?:${extensions.join('|')})$`);
	const pending = new Map<string, Promise<Part[] | undefined>>();
	return {
		name,
		resolveId: { filter: { id: partId }, handler: (source) => ({ id: source }) },
		load: {
			filter: { id: { include: [component, partId] } },
			async handler(id) {
				const part = partId.exec(id);
				const filename = part === null ? id : id.slice(0, part.index);
				let parts = pending.get(filename);
				if (parts === undefined) {
					const frontEnd = parsing.find((candidate) =>
						candidate.components.some((extension) => filename.endsWith(extension))
					) as FrontEnd;
					parts = split(frontEnd.compiler, filename);
					pending.set(filename, parts);
				}
				const found = await parts;
				if (found === undefined) return null;
				if (part === null) return { code: facade(filename, found), moduleType: 'js' };
				const chosen = found[Number(part[1])] as Part;
				return { code: chosen.code, moduleType: chosen.lang };
			}
		}
	};
}

export function scanPlugin(prefix: string, frontEnds: readonly FrontEnd[]): Rolldown.Plugin {
	const parsing = frontEnds.filter((frontEnd) => frontEnd.compiler.parse !== undefined);
	const plugin: Rolldown.Plugin = {
		name: `${prefix}:scan`,
		options(input) {
			if (parsing.length === 0 || !scanning(input)) return;
			const plugins = (input.plugins ?? []) as Rolldown.Plugin[];
			return {
				...input,
				plugins: plugins.map((entry) => (entry === plugin ? scanner(plugin.name, parsing) : entry))
			};
		}
	};
	return plugin;
}
