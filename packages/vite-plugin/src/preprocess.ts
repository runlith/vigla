import process from 'node:process';
import * as vite from 'vite';
import type { InlineConfig, ResolvedConfig } from 'vite';
import type { Preprocessor, PreprocessorGroup } from './compiler.ts';
import { mapToRelative, removeLangSuffix, type FileRefs } from './maps.ts';
import type { VitePreprocessOptions } from './public.ts';

type CssTransform = (
	code: string,
	filename: string
) => Promise<{ code: string; map?: FileRefs | null; deps?: Set<string> }>;

type Oxc = (
	code: string,
	filename: string,
	options: object
) => Promise<{ code: string; map: FileRefs | null }>;

const { isCSSRequest, preprocessCSS, resolveConfig } = vite;
const transformWithOxc = (vite as unknown as { transformWithOxc: Oxc }).transformWithOxc;

const scriptLangs = ['ts'];
const separator = '.vite-preprocess';

interface Tagged {
	__resolvedConfig?: ResolvedConfig | null;
}

function script(): Preprocessor {
	return async ({ attributes, content, filename = '' }) => {
		if (typeof attributes.lang !== 'string' || !scriptLangs.includes(attributes.lang))
			return undefined;
		const { code, map } = await transformWithOxc(content, filename, {
			lang: attributes.lang,
			target: 'esnext',
			typescript: { onlyRemoveTypeImports: true }
		});
		mapToRelative(map, filename);
		return { code, map: map ?? undefined };
	};
}

function resolved(config: ResolvedConfig | InlineConfig): config is ResolvedConfig {
	return !!(config as ResolvedConfig).inlineConfig;
}

async function cssTransform(
	style: Tagged,
	config: ResolvedConfig | InlineConfig
): Promise<CssTransform> {
	let resolvedConfig: ResolvedConfig;
	if (style.__resolvedConfig) resolvedConfig = style.__resolvedConfig;
	else if (resolved(config)) resolvedConfig = config;
	else {
		const build = !process.env.NODE_ENV || process.env.NODE_ENV === 'production';
		const mode = build ? 'production' : 'development';
		resolvedConfig = await resolveConfig(config, build ? 'build' : 'serve', mode, mode, false);
	}
	return (code, filename) =>
		preprocessCSS(code, filename, resolvedConfig) as ReturnType<CssTransform>;
}

function style(config: ResolvedConfig | InlineConfig = {}): Preprocessor {
	let transform: Promise<CssTransform> | CssTransform | undefined;
	const run = (async ({ attributes, content, filename = '' }) => {
		const extension = attributes.lang ? `.${attributes.lang}` : '.css';
		if (attributes.lang && !isCSSRequest(extension)) return undefined;
		transform ??= cssTransform(run, config).then((ready) => (transform = ready));
		const ready = await transform;
		const suffix = `${separator}${extension}`;
		const { code, map, deps } = await ready(content, `${filename}${suffix}`);
		removeLangSuffix(map, suffix);
		mapToRelative(map, filename);
		const dependencies = deps ? [...deps].filter((dep) => !dep.endsWith(suffix)) : undefined;
		return { code, map: map ?? undefined, dependencies };
	}) as Preprocessor & Tagged;
	run.__resolvedConfig = null;
	return run;
}

export function vitePreprocess(options?: VitePreprocessOptions): PreprocessorGroup {
	const group: PreprocessorGroup = { name: 'vite-preprocess' };
	if (options?.script === true) group.script = script();
	if (options?.style !== false) {
		group.style = style(typeof options?.style === 'object' ? options.style : undefined);
	}
	return group;
}
