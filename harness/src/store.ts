import { cpSync, existsSync, mkdirSync, readFileSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface Manifest {
	name: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
}

export interface Store {
	root: string;
	workspace: ReadonlyMap<string, string>;
	installed?: string;
	copies: Map<string, string>;
	linked: Set<string>;
}

export function store(
	root: string,
	workspace: ReadonlyMap<string, string>,
	installed?: string
): Store {
	return {
		root,
		workspace,
		...(installed === undefined ? {} : { installed }),
		copies: new Map(),
		linked: new Set()
	};
}

export function read(dir: string): Manifest {
	return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Manifest;
}

function copy(name: string, source: string, into: Store): string {
	const id = `${name}\n${source}`;
	const done = into.copies.get(id);
	if (done !== undefined) return done;
	const modules = join(into.root, String(into.copies.size), 'node_modules');
	const at = join(modules, name);
	into.copies.set(id, at);
	cpSync(source, at, {
		recursive: true,
		filter: (file) => !file.slice(source.length).split('/').includes('node_modules')
	});
	link(modules, at, source, into);
	return at;
}

function link(modules: string, dir: string, from: string, into: Store): void {
	const manifest = read(dir);
	for (const [name, spec] of Object.entries({
		...manifest.dependencies,
		...manifest.devDependencies
	})) {
		const at = join(modules, name);
		let target: string | undefined;
		if (spec.startsWith('file:'))
			target = copy(name, resolve(from, spec.slice('file:'.length)), into);
		else if (spec.startsWith('link:')) target = resolve(from, spec.slice('link:'.length));
		else if (spec.startsWith('workspace:')) target = into.workspace.get(name);
		if (
			target === undefined &&
			into.installed !== undefined &&
			existsSync(join(into.installed, name))
		)
			target = join(into.installed, name);
		if (target === undefined || existsSync(at)) continue;
		mkdirSync(join(at, '..'), { recursive: true });
		symlinkSync(target, at, 'dir');
		if (into.installed !== undefined && target.startsWith(`${into.installed}/`)) continue;
		if (!spec.startsWith('file:') && !into.linked.has(target)) {
			into.linked.add(target);
			install(target, into);
		}
	}
}

export function install(dir: string, into: Store): void {
	const modules = join(dir, 'node_modules');
	mkdirSync(modules, { recursive: true });
	link(modules, dir, dir, into);
}
