import type { Environment, InlineConfig, ResolvedConfig } from 'vite';
import type { CompileOptions, PreprocessorGroup, Warning } from './compiler.ts';

type Arrayable<T> = T | T[];

export interface DynamicCompileInput {
	filename: string;
	code: string;
	compileOptions: Partial<CompileOptions>;
	environment: Environment;
}

export type DynamicCompileOptions = (
	data: DynamicCompileInput
) => Promise<Partial<CompileOptions> | void> | Partial<CompileOptions> | void;

export interface CompileModuleOptions {
	infixes?: string[];
	extensions?: string[];
	include?: Arrayable<string | RegExp>;
	exclude?: Arrayable<string | RegExp>;
}

export interface ExperimentalOptions {
	sendWarningsToBrowser?: boolean;
	disableSvelteResolveWarnings?: boolean;
	compileModule?: CompileModuleOptions;
}

export interface PluginOptions {
	include?: Arrayable<string | RegExp>;
	exclude?: Arrayable<string | RegExp>;
	emitCss?: boolean;
	disableDependencyReinclusion?: boolean | string[];
	prebundleSvelteLibraries?: boolean;
	inspector?: boolean | object;
	dynamicCompileOptions?: DynamicCompileOptions;
	experimental?: ExperimentalOptions;
}

export interface SvelteConfig {
	extensions?: string[];
	preprocess?: Arrayable<PreprocessorGroup>;
	compilerOptions?: Omit<CompileOptions, 'filename' | 'format' | 'generate'>;
	onwarn?: (warning: Warning, defaultHandler: (warning: Warning) => void) => void;
	vitePlugin?: PluginOptions;
}

export interface Options extends Omit<SvelteConfig, 'vitePlugin'>, PluginOptions {
	configFile?: string | false;
}

export interface VitePreprocessOptions {
	script?: boolean;
	style?: boolean | InlineConfig | ResolvedConfig;
}
