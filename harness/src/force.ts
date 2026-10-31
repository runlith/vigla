import { existsSync, readFileSync } from 'node:fs';
import { registerHooks, type ResolveHookContext, type ResolveFnOutput } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const marker = 'harness-forced';
const packages = new Map<string, string | null>();
const compilers = new Map<string, string | null>();

type Next = (specifier: string, context?: Partial<ResolveHookContext>) => ResolveFnOutput;

function wrapper(real: string): string {
	const from = JSON.stringify(real);
	return [
		`import * as real from ${from};`,
		`export * from ${from};`,
		'export function compile(source, options) {',
		'\tconst own = options ?? {};',
		'\treturn real.compile(source, { ...own, experimental: { ...own.experimental, async: true }, runes: own.runes ?? true });',
		'}',
		'export function compileModule(source, options) {',
		'\tconst own = options ?? {};',
		'\treturn real.compileModule(source, { ...own, experimental: { ...own.experimental, async: true } });',
		'}'
	].join('\n');
}

function packageFile(directory: string): string | null {
	const known = packages.get(directory);
	if (known !== undefined) return known;
	const candidate = join(directory, 'package.json');
	const parent = dirname(directory);
	const found = existsSync(candidate)
		? candidate
		: parent === directory
			? null
			: packageFile(parent);
	packages.set(directory, found);
	return found;
}

function declaredCompiler(file: string, context: ResolveHookContext, next: Next): string | null {
	const known = compilers.get(file);
	if (known !== undefined) return known;
	let url: string | null = null;
	const manifest = JSON.parse(readFileSync(file, 'utf8'));
	const entry = manifest.vigla?.frontEnd?.compiler;
	if (typeof manifest.name === 'string' && typeof entry === 'string') {
		try {
			url = next(entry.replace(/^\./, manifest.name), {
				...context,
				parentURL: pathToFileURL(file).href
			}).url;
		} catch {
			url = null;
		}
	}
	compilers.set(file, url);
	return url;
}

function frontEndCompiler(url: string, context: ResolveHookContext, next: Next): boolean {
	const file = packageFile(dirname(fileURLToPath(url)));
	return file !== null && declaredCompiler(file, context, next) === url;
}

registerHooks({
	resolve(specifier, context, next) {
		const resolved = next(specifier, context);
		if (context.parentURL?.endsWith(`?${marker}`)) return resolved;
		if (!resolved.url.startsWith('file:') || !/\.[jt]s$/.test(resolved.url)) return resolved;
		if (specifier !== 'svelte/compiler' && !frontEndCompiler(resolved.url, context, next))
			return resolved;
		return { ...resolved, url: `${resolved.url}?${marker}`, shortCircuit: true };
	},
	load(url, context, next) {
		if (!url.endsWith(`?${marker}`)) return next(url, context);
		return {
			format: 'module',
			source: wrapper(url.slice(0, -marker.length - 1)),
			shortCircuit: true
		};
	}
});
