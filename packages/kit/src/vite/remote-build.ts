import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import remapping from '@jridgewell/remapping';
import MagicString from 'magic-string';
import type { ESTree, Rolldown } from 'vite';
import { write } from '../build/index.ts';
import type { Project } from './project.ts';

interface OutputModule {
	file: string;
	code: string;
	body: ESTree.Program['body'];
	edits: MagicString;
}
interface Binding {
	module: OutputModule;
	variable: ESTree.VariableDeclarator;
}

function nameOf(node: ESTree.Node): string | undefined {
	return node.type === 'Identifier'
		? node.name
		: 'value' in node && typeof node.value === 'string'
			? node.value
			: undefined;
}

function throughChunkMap(treeshaken: string, file: string, original: string): string {
	const map = JSON.parse(treeshaken) as { sources: string[] };
	const chunk = path.basename(file);
	map.sources = map.sources.map((source) => (path.basename(source) === chunk ? chunk : source));
	return JSON.stringify(
		remapping(map as Parameters<typeof remapping>[0], (source) =>
			source === chunk ? JSON.parse(original) : null
		)
	);
}

export async function pruneRemotes(project: Project): Promise<void> {
	const context = project.build!;
	const directory = path.join(context.config.outDir, 'output/server');
	const modules = new Map<string, OutputModule>();
	const changed = new Set<OutputModule>();
	const replaced = new Set<ESTree.VariableDeclarator>();
	const message = project.diagnostics.text(
		'remote_prerender_not_dynamic',
		'Unexpectedly called `prerender` function. Did you forget to set `{ dynamic: true }`?'
	);
	function load(file: string): OutputModule {
		const previous = modules.get(file);
		if (previous) return previous;
		const code = readFileSync(file, 'utf8');
		const parsed = project.api.parseSync(file, code, { sourceType: 'module' });
		if (parsed.errors.length) throw new Error(parsed.errors[0]!.message);
		const module = { file, code, body: parsed.program.body, edits: new MagicString(code) };
		modules.set(file, module);
		return module;
	}
	function local(module: OutputModule, name: string): Binding {
		for (const statement of module.body) {
			if (statement.type === 'ImportDeclaration') {
				for (const specifier of statement.specifiers) {
					if (specifier.local.name !== name) continue;
					if (specifier.type === 'ImportNamespaceSpecifier') break;
					const imported =
						specifier.type === 'ImportDefaultSpecifier' ? 'default' : nameOf(specifier.imported)!;
					return exported(
						load(path.resolve(path.dirname(module.file), statement.source.value)),
						imported
					);
				}
			}
			const declaration =
				statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
			if (declaration?.type !== 'VariableDeclaration') continue;
			for (const variable of declaration.declarations) {
				if (variable.id.type !== 'Identifier' || variable.id.name !== name) continue;
				return variable.init?.type === 'Identifier'
					? local(module, variable.init.name)
					: { module, variable };
			}
		}
		throw new Error(`Cannot locate remote binding ${name} in ${module.file}`);
	}
	function exported(module: OutputModule, name: string): Binding {
		for (const statement of module.body) {
			if (
				statement.type === 'ExportDefaultDeclaration' &&
				name === 'default' &&
				statement.declaration.type === 'Identifier'
			)
				return local(module, statement.declaration.name);
			if (statement.type !== 'ExportNamedDeclaration') continue;
			for (const specifier of statement.specifiers) {
				if (nameOf(specifier.exported) !== name) continue;
				const binding = nameOf(specifier.local)!;
				return statement.source
					? exported(load(path.resolve(path.dirname(module.file), statement.source.value)), binding)
					: local(module, binding);
			}
			if (statement.declaration?.type === 'VariableDeclaration')
				for (const variable of statement.declaration.declarations)
					if (variable.id.type === 'Identifier' && variable.id.name === name)
						return local(module, name);
		}
		throw new Error(`Cannot locate remote export ${name} in ${module.file}`);
	}
	for (const [id, metadata] of context.analysis.remotes) {
		const names = [...metadata].filter(([, value]) => value.type === 'prerender' && !value.dynamic);
		if (!names.length) continue;
		const entry = exported(load(path.join(directory, context.artifacts.remotes[id]!)), 'default');
		let namespace: ESTree.Expression | null | undefined = entry.variable.init;
		if (namespace?.type === 'CallExpression')
			namespace = namespace.arguments.find((argument) => argument.type === 'ObjectExpression') as
				| ESTree.ObjectExpression
				| undefined;
		if (namespace?.type !== 'ObjectExpression')
			throw new Error(`Cannot locate remote namespace ${id}`);
		for (const [name] of names) {
			const property = namespace.properties.find(
				(property) => property.type === 'Property' && nameOf(property.key) === name
			);
			if (!property || property.type !== 'Property')
				throw new Error(`Cannot locate remote function ${id}/${name}`);
			let value = property.value;
			if (value.type === 'ArrowFunctionExpression' && value.body.type === 'Identifier')
				value = value.body;
			if (property.kind === 'get' && value.type === 'FunctionExpression' && value.body) {
				const returned = value.body.body.find((statement) => statement.type === 'ReturnStatement');
				if (returned?.type === 'ReturnStatement' && returned.argument) value = returned.argument;
			}
			if (value.type !== 'Identifier')
				throw new Error(
					`Cannot locate remote function binding ${id}/${name}: ${entry.module.code.slice(property.start, property.end)}`
				);
			const binding = local(entry.module, value.name);
			if (replaced.has(binding.variable)) continue;
			const init = binding.variable.init;
			if (init?.type !== 'CallExpression')
				throw new Error(`Cannot locate remote factory ${id}/${name}`);
			const factory = binding.module.code.slice(init.callee.start, init.callee.end);
			binding.module.edits.overwrite(
				init.start,
				init.end,
				`${factory}('unchecked', () => { throw new Error(${JSON.stringify(message)}) })`
			);
			replaced.add(binding.variable);
			changed.add(binding.module);
		}
	}
	for (const module of changed) {
		const chunkMap = module.file + '.map';
		const original = existsSync(chunkMap) ? readFileSync(chunkMap, 'utf8') : null;
		const result = (await project.api.build({
			root: project.root,
			configFile: false,
			logLevel: 'silent',
			publicDir: false,
			plugins: [
				{
					name: 'kit:prerender-remotes',
					transform(_code, id) {
						if (id !== module.file) return;
						return {
							code: module.edits.toString(),
							map: module.edits.generateMap({
								source: module.file,
								includeContent: true,
								hires: 'boundary'
							})
						};
					}
				}
			],
			build: {
				ssr: true,
				write: false,
				minify: false,
				target: 'esnext',
				sourcemap: project.vite.environments.ssr?.build?.sourcemap ?? project.vite.build.sourcemap,
				rolldownOptions: {
					input: module.file,
					external: (id) => id !== module.file,
					output: { entryFileNames: path.basename(module.file) }
				}
			}
		})) as Rolldown.RolldownOutput;
		for (const output of result.output)
			write(
				output.type === 'chunk' ? module.file : chunkMap,
				output.type === 'chunk'
					? output.code
					: original
						? throughChunkMap(String(output.source), module.file, original)
						: output.source
			);
	}
}
