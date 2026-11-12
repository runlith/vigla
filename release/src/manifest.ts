export type Target = string | null | { [condition: string]: Target } | Target[];

export interface Manifest {
	name: string;
	version: string;
	private?: boolean;
	files?: string[];
	bin?: string | Record<string, string>;
	main?: string;
	module?: string;
	types?: string;
	exports?: Target;
	imports?: Record<string, Target>;
	scripts?: Record<string, string>;
	dependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	optionalDependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	release?: Release;
	[field: string]: unknown;
}

export interface Release {
	exports?: Record<string, Record<string, string>>;
	version?: string;
}

interface Sibling {
	name: string;
	range: string;
	alias: boolean;
}

const dependencyFields = ['dependencies', 'peerDependencies', 'optionalDependencies'] as const;
const source = /^\.\/src\/(.*)\.ts$/;

function sibling(dependency: string, range: string): Sibling | undefined {
	if (!range.startsWith('workspace:')) return undefined;
	const spec = range.slice('workspace:'.length);
	const alias = /^(@?[^@]+)@(.*)$/.exec(spec);
	return alias
		? { name: alias[1]!, range: alias[2]!, alias: true }
		: { name: dependency, range: spec, alias: false };
}

export function siblings(manifest: Manifest): string[] {
	return dependencyFields.flatMap((field) =>
		Object.entries(manifest[field] ?? {}).flatMap(([dependency, range]) => {
			const found = sibling(dependency, range);
			return found ? [found.name] : [];
		})
	);
}

export function publishedTarget(target: string, condition: string | null): string {
	const match = source.exec(target);
	if (!match || target.endsWith('.d.ts')) return target;
	return `./dist/${match[1]}${condition === 'types' ? '.d.ts' : '.js'}`;
}

function mapTarget(target: Target, condition: string | null): Target {
	if (typeof target === 'string') return publishedTarget(target, condition);
	if (target === null) return null;
	if (Array.isArray(target)) return target.map((item) => mapTarget(item, condition));
	return Object.fromEntries(
		Object.entries(target).map(([key, value]) => [
			key,
			mapTarget(value, key.startsWith('.') || key.startsWith('#') ? null : key)
		])
	);
}

function patchExports(exports: Target, patch: Release['exports'], name: string): Target {
	if (!patch) return exports;
	if (exports === null || typeof exports !== 'object' || Array.isArray(exports))
		throw new Error(`${name}: release.exports needs an exports map`);
	const patched = { ...exports };
	for (const [key, conditions] of Object.entries(patch)) {
		const base = patched[key];
		if (base === undefined)
			throw new Error(`${name}: release.exports names ${key}, absent from exports`);
		if (typeof base === 'string' || base === null || Array.isArray(base)) {
			patched[key] = { ...conditions, default: base };
			continue;
		}
		const { types, ...rest } = base;
		const kept = Object.fromEntries(
			Object.entries(rest).filter(([condition]) => !(condition in conditions))
		);
		patched[key] = { ...(types === undefined ? {} : { types }), ...conditions, ...kept };
	}
	return patched;
}

function pinnedRange(range: string, version: string): string {
	if (range === '*' || range === '') return version;
	if (range === '^' || range === '~') return range + version;
	return range;
}

function pinWorkspace(
	dependencies: Record<string, string>,
	versions: ReadonlyMap<string, string>,
	name: string
): Record<string, string> {
	return Object.fromEntries(
		Object.entries(dependencies).map(([dependency, range]) => {
			const found = sibling(dependency, range);
			if (!found) return [dependency, range];
			const version = versions.get(found.name);
			if (version === undefined)
				throw new Error(`${name}: ${dependency} names no workspace package ${found.name}`);
			const pinned = pinnedRange(found.range, version);
			return [dependency, found.alias ? `npm:${found.name}@${pinned}` : pinned];
		})
	);
}

export function publishedManifest(
	manifest: Manifest,
	versions: ReadonlyMap<string, string>
): Manifest {
	const { scripts, devDependencies, release, ...published } = manifest;
	for (const field of ['main', 'module', 'types'] as const) {
		const value = published[field];
		if (value !== undefined)
			published[field] = publishedTarget(value, field === 'types' ? 'types' : null);
	}
	if (typeof published.bin === 'string') published.bin = publishedTarget(published.bin, null);
	else if (published.bin)
		published.bin = Object.fromEntries(
			Object.entries(published.bin).map(([command, file]) => [command, publishedTarget(file, null)])
		);
	if (published.exports !== undefined)
		published.exports = patchExports(
			mapTarget(published.exports, null),
			release?.exports,
			manifest.name
		);
	if (published.imports)
		published.imports = mapTarget(published.imports, null) as Record<string, Target>;
	for (const field of dependencyFields) {
		const dependencies = published[field];
		if (dependencies) published[field] = pinWorkspace(dependencies, versions, manifest.name);
	}
	return published;
}

export function targets(value: Target | undefined): string[] {
	if (typeof value === 'string') return [value];
	if (value === null || value === undefined) return [];
	if (Array.isArray(value)) return value.flatMap(targets);
	return Object.values(value).flatMap(targets);
}
