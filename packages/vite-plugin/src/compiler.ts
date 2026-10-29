export interface Position {
	line: number;
	column: number;
	character?: number;
}

export interface Warning {
	code: string;
	message: string;
	filename?: string;
	start?: Position;
	end?: Position;
	frame?: string;
}

export interface CompileError extends Error, Warning {}

export interface SourceMap {
	file?: string;
	sources?: (string | null)[];
	sourceRoot?: string;
	mappings: unknown;
	toUrl?: () => string;
}

export interface Code {
	code: string;
	map: SourceMap | null;
}

export interface Css extends Code {
	hasGlobal: boolean;
}

export interface CompileResult {
	js: Code;
	css: Css | null;
	warnings: Warning[];
}

export interface CssHashInput {
	name: string;
	filename: string;
	css: string;
	hash: (input: string) => string;
}

export interface Experimental {
	async?: boolean;
	[name: string]: unknown;
}

export interface ModuleCompileOptions {
	filename?: string;
	rootDir?: string;
	dev?: boolean;
	generate?: 'client' | 'server' | false;
	warningFilter?: (warning: Warning) => boolean;
	experimental?: Experimental;
}

export interface CompileOptions extends ModuleCompileOptions {
	css?: 'injected' | 'external';
	cssHash?: (input: CssHashInput) => string;
	hmr?: boolean;
	sourcemap?: object | string;
	[name: string]: unknown;
}

export interface Processed {
	code: string;
	map?: string | object;
	dependencies?: string[];
	attributes?: Record<string, string | boolean>;
	toString?: () => string;
}

export type MarkupPreprocessor = (options: {
	content: string;
	filename?: string;
}) => Processed | void | Promise<Processed | void>;

export type Preprocessor = (options: {
	content: string;
	attributes: Record<string, string | boolean>;
	markup: string;
	filename?: string;
}) => Processed | void | Promise<Processed | void>;

export interface PreprocessorGroup {
	name?: string;
	markup?: MarkupPreprocessor;
	style?: Preprocessor;
	script?: Preprocessor;
}

export interface Compiler {
	compile(source: string, options: CompileOptions): CompileResult;
	compileModule(source: string, options: ModuleCompileOptions): CompileResult;
	preprocess(
		source: string,
		preprocessor: PreprocessorGroup | PreprocessorGroup[],
		options?: { filename?: string }
	): Promise<Processed>;
}
