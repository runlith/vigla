import {
	analyzeStyle,
	compile as compileUnit,
	hash,
	compileModule as compileModuleUnit,
	validateComponent as validateUnit,
	validateModule as validateModuleUnit,
	type Code,
	type Diagnostic,
	type InputMap,
	type Runtime,
	type ValidateOptions
} from 'vigla/compiler';
import {
	front,
	legacy,
	lowerComponent,
	parseComponent,
	parseStylesheet,
	validateComponent,
	validateModuleSyntax,
	type AST,
	type Parsed
} from '../front/index.ts';
import { Diagnostics, relativeFilename, type Warning } from './diagnostics.ts';
import { validate } from './options.ts';
import { format } from '../shared/format.ts';

export { CompileError, CompileWarning, type Location, type Warning } from './diagnostics.ts';
export { format } from '../shared/format.ts';
export { print, type PrintOptions, type Printed } from '../front/index.ts';
export {
	preprocess,
	type MarkupPreprocessor,
	type Preprocessor,
	type PreprocessorGroup,
	type Processed
} from './preprocess/index.ts';
export type { AST };

export const VERSION = '5.57.3';

export interface Experimental {
	async?: boolean;
}

export interface ModuleCompileOptions {
	filename?: string;
	rootDir?: string;
	dev?: boolean;
	generate?: 'client' | 'server' | false;
	warningFilter?: (warning: Warning) => boolean;
	experimental?: Experimental;
}

export interface CssHashInput {
	name: string;
	filename: string;
	css: string;
	hash: (input: string) => string;
}

export interface CompileOptions extends ModuleCompileOptions {
	name?: string;
	runes?: boolean;
	css?: 'injected' | 'external';
	cssHash?: (input: CssHashInput) => string;
	cssOutputFilename?: string;
	outputFilename?: string;
	customElement?: boolean;
	discloseVersion?: boolean;
	namespace?: 'html' | 'svg' | 'mathml';
	modernAst?: boolean;
	preserveComments?: boolean;
	preserveWhitespace?: boolean;
	fragments?: 'html' | 'tree';
	hmr?: boolean;
	sourcemap?: InputMap;
}

export interface Metadata {
	runes: boolean;
}

export interface CssResult {
	code: string;
	map: unknown;
	hasGlobal: boolean;
}

export interface CompileResult {
	js: Code | null;
	css: CssResult | null;
	warnings: Warning[];
	metadata: Metadata;
	ast?: AST.Root | Record<string, any>;
}

export interface ParseOptions {
	filename?: string;
	rootDir?: string;
	modern?: boolean;
	loose?: boolean;
}

const stores = ['svelte/store'];

const runtime: Runtime = {
	client: 'svelte/internal/client',
	server: 'svelte/internal/server',
	names: { pre: 'user_pre_effect', userEffect: 'user_effect' }
};

function generated(options: ModuleCompileOptions): 'client' | 'server' {
	return options.generate === 'server' ? 'server' : 'client';
}

function sourceName(filename: string | undefined): string {
	const parts = (filename ?? '(unknown)').split(/[/\\]/);
	const base = parts.pop() as string;
	const directory = parts.at(-1);
	let name = base.replace('.svelte', '');
	if (name === 'index' && directory && directory !== 'src') name = directory;
	return name.charAt(0).toUpperCase() + name.slice(1);
}

function functionName(preferred: string): string {
	return preferred.replace(/[^a-zA-Z0-9_$]/g, '_').replace(/^[0-9]/, '_');
}

function styleHash(root: AST.Root, options: CompileOptions, name: string): string {
	if (root.css === null) return '';
	const css = root.css.content.styles;
	const filename = relativeFilename(options);
	if (options.cssHash) return options.cssHash({ name, filename, css, hash });
	return `svelte-${hash(filename === '(unknown)' ? css : filename)}`;
}

function publicAst(
	source: string,
	parsed: Parsed,
	modern: boolean | undefined
): AST.Root | Record<string, any> {
	return modern ? parsed.root : legacy(source, parsed.root, parsed.options);
}

function withoutBom(source: string): string {
	return source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
}

export function parse(source: string, options: ParseOptions & { modern: true }): AST.Root;
export function parse(source: string, options?: ParseOptions): Record<string, any>;
export function parse(
	input: string,
	{ modern, loose }: ParseOptions = {}
): AST.Root | Record<string, any> {
	if (typeof input !== 'string') throw new TypeError('Template must be a string');
	const source = withoutBom(input);
	return new Diagnostics(source, {}).guard(() => {
		const parsed = parseComponent(source, loose);
		return modern ? parsed.root : legacy(source, parsed.root, parsed.options);
	});
}

export function parseCss(input: string): AST.Css.StyleSheetFile {
	const source = withoutBom(input);
	return new Diagnostics(source, {}).guard(() => parseStylesheet(source));
}

export function compile(input: string, options: CompileOptions = {}): CompileResult {
	const source = withoutBom(input);
	const diagnostics = new Diagnostics(source, options, options.warningFilter);
	return diagnostics.guard(() => {
		const notices = diagnostics.notices(validate(options, 'component'));
		const parsed = parseComponent(source);
		diagnostics.analysing();
		const reading = lowerComponent(parsed, source, options.filename ?? null);
		const syntax = validateComponent(parsed, source, {
			customElement: options.customElement === true,
			filename: options.filename
		});
		const validation: ValidateOptions = {
			customElement: options.customElement === true,
			namespace: options.namespace,
			stores,
			front: {
				before: syntax.before,
				at: syntax.anchors.translated(reading.lowered, reading.anchored)
			}
		};
		const reported = (core: readonly Diagnostic[]): Warning[] => [
			...notices,
			...diagnostics.warnings([...syntax.parse, ...core])
		];
		const named = sourceName(options.filename);
		const name = functionName(options.name ?? named);
		const css = {
			hash: styleHash(parsed.root, options, named),
			inject: options.css === 'injected',
			outputFilename: options.cssOutputFilename
		};
		if (options.generate === false) {
			const core = validateUnit(reading.unit, validation);
			const style = analyzeStyle(reading.unit, { hash: css.hash });
			return {
				js: null,
				css: null,
				warnings: reported([...core, ...style.warnings]),
				metadata: { runes: true },
				ast: publicAst(source, parsed, options.modernAst)
			};
		}
		const output = compileUnit(reading.unit, {
			generate: generated(options),
			runtime,
			format,
			devFilename: relativeFilename(options),
			discloseVersion: options.discloseVersion === false ? false : '5',
			name,
			css,
			dev: options.dev,
			namespace: options.namespace,
			preserveWhitespace: options.preserveWhitespace,
			preserveComments: options.preserveComments,
			validation,
			outputFilename: options.outputFilename,
			inputMap: options.sourcemap,
			hmr: options.hmr
		});
		return {
			js: output.js,
			css: output.css,
			warnings: reported(output.warnings),
			metadata: { runes: true },
			ast: publicAst(source, parsed, options.modernAst)
		};
	});
}

export function compileModule(input: string, options: ModuleCompileOptions = {}): CompileResult {
	const source = withoutBom(input);
	const diagnostics = new Diagnostics(source, options, options.warningFilter);
	return diagnostics.guard(() => {
		const notices = diagnostics.notices(validate(options, 'module'));
		diagnostics.analysing();
		const reading = front.module({ source, filename: options.filename ?? null });
		const program = reading.unit.program;
		const validation: ValidateOptions = {
			stores,
			front: { at: validateModuleSyntax(program).translated(new Map(), new Map()) }
		};
		if (options.generate === false) {
			const core = validateModuleUnit(reading.unit, validation);
			return {
				js: null,
				css: null,
				warnings: [...notices, ...diagnostics.warnings(core)],
				metadata: { runes: true }
			};
		}
		const output = compileModuleUnit(reading.unit, {
			generate: generated(options),
			runtime,
			dev: options.dev,
			validation
		});
		return {
			js: output.js,
			css: null,
			warnings: [...notices, ...diagnostics.warnings(output.warnings)],
			metadata: { runes: true }
		};
	});
}
