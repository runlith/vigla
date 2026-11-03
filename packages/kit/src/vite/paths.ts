import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

export const packageDirectory = fileURLToPath(new URL('../../', import.meta.url));
export const codeDirectory = fileURLToPath(new URL('../', import.meta.url));
const codeExtension = path.extname(fileURLToPath(import.meta.url));
export function codeFile(name: string): string {
	return path.join(codeDirectory, name + codeExtension);
}
export const packageImporter = codeFile('vite/index');
const sourceDirectory = posix(codeDirectory);

export interface ImportAlias {
	alias: string;
	path: string;
}
export interface ProjectDirectories {
	root: string;
	node_modules: string;
	routes: string;
	assets: string;
}
interface PackageManifest {
	name?: string;
	imports?: Record<string, unknown>;
	peerDependencies?: Record<string, string>;
}

export function posix(file: string): string {
	return file.replaceAll('\\', '/');
}

export function fileUrl(file: string): string {
	const normalized = posix(file);
	return `/@fs${normalized.startsWith('/') ? '' : '/'}${normalized}`;
}

export function moduleUrl(file: string, root: string): string {
	const relative = posix(path.relative(root, file));
	return relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)
		? fileUrl(file)
		: '/' + relative;
}

export function installedName(root: string): string {
	const require = createRequire(path.join(root, 'package.json'));
	for (const name of ['@sveltejs/kit', '@vigla/kit']) {
		try {
			const file = require.resolve(`${name}/package.json`);
			if (JSON.parse(readFileSync(file, 'utf8')).name === '@vigla/kit') return name;
		} catch {}
	}
	throw new Error(`Cannot resolve @vigla/kit from ${root}`);
}

function targets(value: unknown): string[] {
	if (typeof value === 'string') return [value];
	if (value === null || typeof value !== 'object') return [];
	return Object.values(value).flatMap(targets);
}

export function importAliases(root: string): ImportAlias[] {
	const file = path.join(root, 'package.json');
	if (!existsSync(file)) return [];
	const manifest = JSON.parse(readFileSync(file, 'utf8')) as PackageManifest;
	return Object.entries(manifest.imports ?? {})
		.flatMap(([alias, value]) =>
			targets(value)
				.filter((target) => target.startsWith('./'))
				.map((target) => ({
					alias: alias.replace(/\/\*$/, ''),
					path: posix(path.resolve(root, target.replace(/\/\*$/, '')))
				}))
		)
		.sort((a, b) => b.path.length - a.path.length);
}

export function normalizeId(id: string, aliases: ImportAlias[], root: string): string {
	id = posix(id.replace(/\?.*$/s, ''));
	if (id === posix(codeFile('entries/app/server/server'))) return '$app/server';
	if (id === posix(codeFile('entries/app/env/private/server'))) return '$app/env/private';
	for (const alias of aliases) {
		if (id === alias.path || id.startsWith(alias.path + '/')) {
			return alias.alias + id.slice(alias.path.length);
		}
	}
	return id.startsWith(root + '/') ? id.slice(root.length + 1) : id;
}

export const remotePattern = /[/.]remote\.[^/]+$/;
export const serverPattern = /[/.]server\.[^/]+$/;
export const serverDirectory = /\/server\//;

export function isServerOnly(id: string, dirs: ProjectDirectories): boolean {
	id = posix(id.split('?')[0]!);
	if (!id.startsWith(dirs.root + '/') || id.startsWith(dirs.node_modules + '/')) return false;
	const relative = id.slice(dirs.root.length);
	return (
		serverPattern.test(relative) ||
		(serverDirectory.test(relative) &&
			!id.startsWith(dirs.routes + '/') &&
			!id.startsWith(dirs.assets + '/'))
	);
}

export function isRemoteModule(id: string): boolean {
	id = posix(id);
	if (!remotePattern.test(id)) return false;
	if (id.startsWith(sourceDirectory)) return false;
	if (!id.split('/').includes('node_modules')) return true;
	let directory = path.dirname(id);
	while (path.basename(directory) !== 'node_modules') {
		const file = path.join(directory, 'package.json');
		if (existsSync(file)) {
			const manifest = JSON.parse(readFileSync(file, 'utf8')) as PackageManifest;
			if (manifest.peerDependencies?.['@sveltejs/kit'] || manifest.peerDependencies?.['@vigla/kit'])
				return true;
		}
		const parent = path.dirname(directory);
		if (parent === directory) break;
		directory = parent;
	}
	return false;
}

export function usesHtmlHook(plugin: Plugin): boolean {
	return (
		!!plugin.transformIndexHtml &&
		plugin.name !== 'vitest:browser:loader' &&
		!plugin.name?.includes('storybook')
	);
}
