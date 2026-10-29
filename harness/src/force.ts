import { registerHooks } from 'node:module';

const marker = 'harness-forced';

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

registerHooks({
	resolve(specifier, context, next) {
		const resolved = next(specifier, context);
		if (specifier !== 'svelte/compiler' || context.parentURL?.endsWith(`?${marker}`))
			return resolved;
		if (!resolved.url.startsWith('file:') || !resolved.url.endsWith('.js')) return resolved;
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
