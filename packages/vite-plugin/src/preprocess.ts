import path from 'node:path';
import process from 'node:process';
import loadPostcss from 'postcss-load-config';
import type { Plugin as PostcssPlugin } from 'postcss';
import parseValue, { type Node as ValueNode } from 'postcss-value-parser';
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

function assetUrls(style: Tagged): PostcssPlugin {
	let resolve: ReturnType<ResolvedConfig['createResolver']> | undefined;
	return {
		postcssPlugin: 'vite-preprocess-urls',
		async OnceExit(root, { result }) {
			const from = result.opts.from;
			if (!from || !/\.vite-preprocess\.[^./]+$/.test(from)) return;
			if (!style.__resolvedConfig)
				throw new Error('style preprocessing has no resolved Vite config');
			resolve ??= style.__resolvedConfig.createResolver({
				preferRelative: true,
				tryIndex: false,
				extensions: []
			});
			const resolveAsset = resolve;
			const declarations: Promise<void>[] = [];
			root.walkDecls((declaration) => {
				if (!/(?:url|image-set)\(/i.test(declaration.value)) return;
				const importer = declaration.source?.input.file ?? from;
				const parsed = parseValue(declaration.value);
				const assets: Promise<void>[] = [];
				const rebase = async (node: ValueNode): Promise<void> => {
					const url = node.value;
					if (!url || /^(?:[a-z][a-z\d+.-]*:|[/#~])/i.test(url)) return;
					const suffix = url.search(/[?#]/);
					const pathname = suffix < 0 ? url : url.slice(0, suffix);
					const tail = suffix < 0 ? '' : url.slice(suffix);
					const file = await resolveAsset(decodeURI(pathname), importer);
					if (!file) return;
					const relative = vite.normalizePath(path.relative(path.dirname(from), file));
					node.value = `${encodeURI(relative)}${tail}`;
				};
				parsed.walk((node) => {
					if (node.type !== 'function') return;
					if (node.value.toLowerCase() === 'url') {
						const value = node.nodes.find((part) => part.type === 'string' || part.type === 'word');
						if (value) assets.push(rebase(value));
						return false;
					}
					if (/^(?:-webkit-)?image-set$/i.test(node.value)) {
						for (const value of node.nodes) {
							if (value.type === 'string') assets.push(rebase(value));
						}
					}
				});
				if (assets.length > 0)
					declarations.push(
						Promise.all(assets).then(() => {
							declaration.value = parsed.toString();
						})
					);
			});
			await Promise.all(declarations);
		}
	};
}

export async function configureStyles(
	groups: PreprocessorGroup[],
	config: InlineConfig
): Promise<void> {
	for (const group of groups) {
		const style = group.style as (PreprocessorGroup['style'] & Tagged) | undefined;
		if (style && '__resolvedConfig' in style) {
			await cssConfig(style, config);
			return;
		}
	}
}

async function cssConfig(style: Tagged, config: InlineConfig): Promise<void> {
	if (config.css?.transformer === 'lightningcss') return;
	const root = path.resolve(config.root ?? process.cwd());
	const inline = config.css?.postcss;
	const postcss =
		typeof inline === 'object'
			? inline
			: await loadPostcss({}, inline ?? root, {
					stopDir: vite.searchForWorkspaceRoot(root)
				})
					.then(({ options, plugins }) => ({ ...options, plugins }))
					.catch((error: unknown) => {
						if (!(error instanceof Error) || !error.message.includes('No PostCSS Config found'))
							throw error;
						return { plugins: [] };
					});
	config.css = {
		...config.css,
		postcss: {
			...postcss,
			plugins: [...(postcss.plugins ?? []), assetUrls(style)]
		} as ResolvedConfig['css']['postcss']
	};
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
		const standalone = { ...config };
		await cssConfig(style, standalone);
		resolvedConfig = await resolveConfig(standalone, build ? 'build' : 'serve', mode, mode, false);
	}
	style.__resolvedConfig = resolvedConfig;
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
