import {
	compile as compileUnit,
	compileModule as compileModuleUnit,
	CompileError as Fault,
	type Code,
	type Diagnostic,
	type Runtime
} from 'dromon/compiler';
import { front } from '../front/index.ts';
import { validate, type Notice } from './options.ts';

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

export interface Location {
	line: number;
	column: number;
	character: number;
}

export interface Warning {
	code: string;
	message: string;
	filename?: string;
	start?: Location;
	end?: Location;
	position?: [number, number];
}

export interface Metadata {
	runes: boolean;
}

export interface CompileResult {
	js: Code;
	css: null;
	warnings: Warning[];
	metadata: Metadata;
}

const runtime: Runtime = { client: 'svelte/internal/client', server: 'svelte/internal/server' };

function locate(source: string, offset: number): Location {
	let line = 1;
	let start = 0;
	for (let index = 0; index < offset && index < source.length; index++) {
		if (source[index] === '\n') {
			line++;
			start = index + 1;
		}
	}
	return { line, column: offset - start, character: offset };
}

export class CompileError extends Error {
	readonly code: string;
	readonly filename: string | undefined;
	readonly position: [number, number];
	readonly start: Location;
	readonly end: Location;

	constructor(diagnostic: Diagnostic, source: string, filename: string | undefined) {
		super(`${diagnostic.message}\nhttps://svelte.dev/e/${diagnostic.code}`);
		this.name = 'CompileError';
		this.code = diagnostic.code;
		this.filename = filename;
		this.position = [diagnostic.start, diagnostic.end];
		this.start = locate(source, diagnostic.start);
		this.end = locate(source, diagnostic.end);
	}
}

function generated(options: ModuleCompileOptions): 'client' | 'server' {
	return options.generate === 'server' ? 'server' : 'client';
}

function warnings(notices: readonly Notice[], filename: string | undefined): Warning[] {
	return notices.map((notice) => ({ code: notice.code, message: notice.message, filename }));
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

function guarded<T>(source: string, filename: string | undefined, run: () => T): T {
	try {
		return run();
	} catch (error) {
		if (error instanceof Fault) throw new CompileError(error.diagnostic, source, filename);
		throw error;
	}
}

export function compile(source: string, options: CompileOptions = {}): CompileResult {
	return guarded(source, options.filename, () => {
		const notices = validate(options, 'component');
		const reading = front.component({ source, filename: options.filename ?? null });
		const output = compileUnit(reading.unit, {
			generate: generated(options),
			runtime,
			name: options.name ?? componentName(options.filename),
			preserveWhitespace: options.preserveWhitespace,
			preserveComments: options.preserveComments
		});
		return {
			js: output.js,
			css: null,
			warnings: warnings(notices, options.filename),
			metadata: { runes: true }
		};
	});
}

export function compileModule(source: string, options: ModuleCompileOptions = {}): CompileResult {
	return guarded(source, options.filename, () => {
		const notices = validate(options, 'module');
		const reading = front.module({ source, filename: options.filename ?? null });
		const output = compileModuleUnit(reading.unit, { generate: generated(options), runtime });
		return {
			js: output.js,
			css: null,
			warnings: warnings(notices, options.filename),
			metadata: { runes: true }
		};
	});
}
