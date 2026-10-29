import {
	analyzeStyle,
	compile as compileUnit,
	hash,
	compileModule as compileModuleUnit,
	validateComponent as validateUnit,
	validateModule as validateModuleUnit,
	type Code,
	type Diagnostic,
	type Runtime
} from 'dromon/compiler';
import {
	front,
	legacy,
	lowerComponent,
	merge,
	parseComponent,
	parseStylesheet,
	phased,
	phases,
	validateComponent,
	type AST
} from '../front/index.ts';
import { Diagnostics, type Warning } from './diagnostics.ts';
import { validate } from './options.ts';

export { CompileError, type Location, type Warning } from './diagnostics.ts';
export { print, type PrintOptions, type Printed } from '../front/index.ts';
export {
	preprocess,
	type MarkupPreprocessor,
	type Preprocessor,
	type PreprocessorGroup,
	type Processed
} from './preprocess/index.ts';
export type { AST };

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
	sourcemap?: object | string;
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
}

export interface ParseOptions {
	filename?: string;
	rootDir?: string;
	modern?: boolean;
	loose?: boolean;
}

const runtime: Runtime = { client: 'svelte/internal/client', server: 'svelte/internal/server' };

function generated(options: ModuleCompileOptions): 'client' | 'server' {
	return options.generate === 'server' ? 'server' : 'client';
}

function componentName(filename: string | undefined): string {
	const parts = (filename ?? '').split(/[/\\]/);
	let base = parts.pop() ?? '';
	if (base.replace(/\.[^.]+$/, '') === 'index' && parts.length > 0) base = parts.pop() ?? base;
	const name = base
		.replace(/\.[^.]+$/, '')
		.replace(/[^a-zA-Z_$0-9]+/g, '_')
		.replace(/^_/, '')
		.replace(/_$/, '');
	if (name === '') return 'Component';
	const capital = name[0]?.toUpperCase() + name.slice(1);
	return /^[0-9]/.test(capital) ? `_${capital}` : capital;
}

function relativeFilename(options: CompileOptions): string {
	const filename = (options.filename ?? '(unknown)').replace(/\\/g, '/');
	const root = options.rootDir?.replace(/\\/g, '/');
	if (root === undefined || !filename.startsWith(root)) return filename;
	return filename.replace(root, '').replace(/^[/\\]/, '');
}

function styleHash(root: AST.Root, options: CompileOptions, name: string): string {
	if (root.css === null) return '';
	const css = root.css.content.styles;
	const filename = relativeFilename(options);
	if (options.cssHash) return options.cssHash({ name, filename, css, hash });
	return `svelte-${hash(filename === '(unknown)' ? css : filename)}`;
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
	return new Diagnostics(source, undefined).guard(() => {
		const parsed = parseComponent(source, loose);
		return modern ? parsed.root : legacy(source, parsed.root, parsed.options);
	});
}

export function parseCss(input: string): AST.Css.StyleSheetFile {
	const source = withoutBom(input);
	return new Diagnostics(source, undefined).guard(() => parseStylesheet(source));
}

export function compile(input: string, options: CompileOptions = {}): CompileResult {
	const source = withoutBom(input);
	const diagnostics = new Diagnostics(source, options.filename, options.warningFilter);
	return diagnostics.guard(() => {
		const notices = diagnostics.notices(validate(options, 'component'));
		const parsed = parseComponent(source);
		const syntax = validateComponent(parsed, source, {
			customElement: options.customElement === true,
			filename: options.filename
		});
		const reading = lowerComponent(parsed, source, options.filename ?? null);
		const own = merge(syntax.walk, reading.warnings, phases(parsed.root));
		const validation = {
			customElement: options.customElement === true,
			namespace: options.namespace,
			warnings: phased(parsed.root, syntax.before, own)
		};
		const reported = (core: readonly Diagnostic[]): Warning[] => [
			...notices,
			...diagnostics.warnings([...syntax.parse, ...core])
		];
		const name = options.name ?? componentName(options.filename);
		const css = {
			hash: styleHash(parsed.root, options, name),
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
				metadata: { runes: true }
			};
		}
		const output = compileUnit(reading.unit, {
			generate: generated(options),
			runtime,
			name,
			css,
			dev: options.dev,
			namespace: options.namespace,
			preserveWhitespace: options.preserveWhitespace,
			preserveComments: options.preserveComments,
			validation
		});
		return {
			js: output.js,
			css: output.css,
			warnings: reported(output.warnings),
			metadata: { runes: true }
		};
	});
}

export function compileModule(input: string, options: ModuleCompileOptions = {}): CompileResult {
	const source = withoutBom(input);
	const diagnostics = new Diagnostics(source, options.filename, options.warningFilter);
	return diagnostics.guard(() => {
		const notices = diagnostics.notices(validate(options, 'module'));
		const reading = front.module({ source, filename: options.filename ?? null });
		if (options.generate === false) {
			const core = validateModuleUnit(reading.unit);
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
			dev: options.dev
		});
		return {
			js: output.js,
			css: null,
			warnings: [...notices, ...diagnostics.warnings(output.warnings)],
			metadata: { runes: true }
		};
	});
}
