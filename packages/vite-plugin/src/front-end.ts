import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { searchForWorkspaceRoot } from 'vite';
import { findDepPkgJsonPath } from 'vitefu';
import type { Compiler } from './compiler.ts';

export interface ModulePattern {
	readonly infixes: readonly string[];
	readonly extensions: readonly string[];
}

export interface Declaration {
	readonly compiler: string;
	readonly components: readonly string[];
	readonly modules: ModulePattern;
	readonly condition: string;
	readonly config: string;
}

export interface FrontEnd {
	readonly name: string;
	readonly compiler: Compiler;
	readonly compilerImport: string;
	readonly components: readonly string[];
	readonly modules: ModulePattern;
	readonly condition: string;
	readonly config: string;
	readonly imports: readonly string[];
}

interface Manifest {
	name?: string;
	version?: string;
	exports?: unknown;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	vigla?: { frontEnd?: Declaration };
}

const conditions = ['node', 'import', 'default'];
const found = new Map<string, Promise<FrontEnd[]>>();

function read(file: string): Manifest {
	return JSON.parse(readFileSync(file, 'utf8')) as Manifest;
}

function target(entry: unknown): string | undefined {
	if (typeof entry === 'string') return entry;
	if (Array.isArray(entry)) {
		for (const item of entry) {
			const resolved = target(item);
			if (resolved !== undefined) return resolved;
		}
		return undefined;
	}
	if (entry === null || typeof entry !== 'object') return undefined;
	for (const [condition, value] of Object.entries(entry)) {
		if (!conditions.includes(condition)) continue;
		const resolved = target(value);
		if (resolved !== undefined) return resolved;
	}
	return undefined;
}

function typesOnly(entry: unknown): boolean {
	return (
		entry !== null &&
		typeof entry === 'object' &&
		!Array.isArray(entry) &&
		Object.keys(entry).length === 1 &&
		'types' in entry
	);
}

function exported(manifest: Manifest): Record<string, unknown> {
	const exports = manifest.exports;
	if (exports === undefined || exports === null) return {};
	if (typeof exports === 'string' || Array.isArray(exports)) return { '.': exports };
	const keys = Object.keys(exports);
	if (keys.length > 0 && !keys[0]?.startsWith('.')) return { '.': exports };
	return exports as Record<string, unknown>;
}

function imports(name: string, manifest: Manifest): string[] {
	return Object.entries(exported(manifest))
		.filter(([key, entry]) => key !== './package.json' && !typesOnly(entry))
		.map(([key]) => key.replace(/^\./, name));
}

async function load(name: string, file: string, manifest: Manifest): Promise<FrontEnd> {
	const declaration = manifest.vigla?.frontEnd as Declaration;
	const entry = target(exported(manifest)[declaration.compiler]);
	if (entry === undefined) {
		throw new Error(`${name} declares compiler ${declaration.compiler} but exports no such entry`);
	}
	const url = pathToFileURL(path.join(path.dirname(file), entry)).href;
	const compiler = (await import(url)) as Compiler;
	return {
		name,
		compiler,
		compilerImport: declaration.compiler.replace(/^\./, name),
		components: declaration.components,
		modules: declaration.modules,
		condition: declaration.condition,
		config: declaration.config,
		imports: imports(name, manifest)
	};
}

function dependencies(dir: string): string[] {
	const file = path.join(dir, 'package.json');
	if (!existsSync(file)) return [];
	const manifest = read(file);
	return [
		...Object.keys(manifest.dependencies ?? {}),
		...Object.keys(manifest.devDependencies ?? {})
	];
}

async function discover(root: string): Promise<FrontEnd[]> {
	const seen = new Set<string>();
	const loading: Promise<FrontEnd>[] = [];
	const workspace = searchForWorkspaceRoot(root);
	for (const dir of workspace === root ? [root] : [root, workspace]) {
		for (const name of dependencies(dir)) {
			if (seen.has(name)) continue;
			seen.add(name);
			const file = await findDepPkgJsonPath(name, dir);
			if (file === undefined) continue;
			const manifest = read(file);
			if (manifest.vigla?.frontEnd !== undefined) loading.push(load(name, file, manifest));
		}
	}
	const list = await Promise.all(loading);
	if (list.length === 0) {
		throw new Error(`no package among the dependencies of ${root} declares a front end`);
	}
	return list;
}

export function frontEnds(root: string): Promise<FrontEnd[]> {
	let pending = found.get(root);
	if (pending === undefined) {
		pending = discover(root);
		found.set(root, pending);
	}
	return pending;
}
