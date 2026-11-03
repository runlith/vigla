import { readFileSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const marker = '?harness-forced';
const original = '?harness-original';
const packages = new Map<string, string | null>();
const compilers = new Map<string, string | null>();

const forced = [
	'function compile(source, options) {',
	'\tconst own = options ?? {};',
	'\treturn real.compile(source, { ...own, experimental: { ...own.experimental, async: true }, runes: own.runes ?? true });',
	'}',
	'function compileModule(source, options) {',
	'\tconst own = options ?? {};',
	'\treturn real.compileModule(source, { ...own, experimental: { ...own.experimental, async: true } });',
	'}'
];

function patched(source: string): string {
	return [
		source,
		';(() => {',
		'const real = module.exports;',
		...forced,
		'module.exports = { ...real, compile, compileModule };',
		'})();'
	].join('\n');
}

function wrapper(real: string): string {
	const from = JSON.stringify(real + original);
	return [
		`import * as real from ${from};`,
		`export * from ${from};`,
		...forced,
		'export { compile, compileModule };'
	].join('\n');
}

function named(file: string): boolean {
	if (!statSync(file, { throwIfNoEntry: false })?.isFile()) return false;
	return typeof JSON.parse(readFileSync(file, 'utf8')).name === 'string';
}

function packageFile(directory: string): string | null {
	const known = packages.get(directory);
	if (known !== undefined) return known;
	const candidate = join(directory, 'package.json');
	const parent = dirname(directory);
	const found = named(candidate) ? candidate : parent === directory ? null : packageFile(parent);
	packages.set(directory, found);
	return found;
}

function exportTarget(value: unknown, conditions: readonly string[]): string | null {
	if (typeof value === 'string') return value;
	if (Array.isArray(value)) {
		for (const item of value) {
			const target = exportTarget(item, conditions);
			if (target !== null) return target;
		}
		return null;
	}
	if (value === null || typeof value !== 'object') return null;
	for (const [condition, nested] of Object.entries(value)) {
		if (condition !== 'default' && !conditions.includes(condition)) continue;
		const target = exportTarget(nested, conditions);
		if (target !== null) return target;
	}
	return null;
}

function declaredCompiler(file: string, conditions: readonly string[]): string | null {
	const key = `${file}\n${conditions.join(',')}`;
	const known = compilers.get(key);
	if (known !== undefined) return known;
	const manifest = JSON.parse(readFileSync(file, 'utf8'));
	const entry =
		manifest.vigla?.frontEnd?.compiler ?? (manifest.name === 'svelte' ? './compiler' : null);
	const exports = manifest.exports;
	const target =
		typeof entry === 'string' &&
		exports !== null &&
		typeof exports === 'object' &&
		!Array.isArray(exports)
			? exportTarget(exports[entry], conditions)
			: null;
	const url = target === null ? null : pathToFileURL(join(dirname(file), target)).href;
	compilers.set(key, url);
	return url;
}

function compilerEntry(url: string, conditions: readonly string[]): boolean {
	const file = packageFile(dirname(fileURLToPath(url)));
	return file !== null && declaredCompiler(file, conditions) === url;
}

registerHooks({
	resolve(specifier, context, next) {
		const resolved = next(specifier, context);
		if (specifier.endsWith(original)) return resolved;
		if (!resolved.url.startsWith('file:') || !/\.[jt]s$/.test(resolved.url)) return resolved;
		if (specifier !== 'svelte/compiler' && !compilerEntry(resolved.url, context.conditions))
			return resolved;
		return { ...resolved, url: resolved.url + marker, shortCircuit: true };
	},
	load(url, context, next) {
		if (!url.endsWith(marker)) return next(url, context);
		const real = url.slice(0, -marker.length);
		const loaded = next(real, context);
		if (loaded.format !== 'commonjs')
			return { format: 'module', source: wrapper(real), shortCircuit: true };
		const source = String(loaded.source ?? readFileSync(fileURLToPath(real)));
		return { format: 'commonjs', source: patched(source), shortCircuit: true };
	}
});
