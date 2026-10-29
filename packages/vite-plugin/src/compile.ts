import type { Environment } from 'vite';
import type { CompileError, CompileOptions, CompileResult } from './compiler.ts';
import { enhanceCompileError } from './error.ts';
import type { ComponentRequest } from './id.ts';
import { log } from './log.ts';
import { mapToRelative } from './maps.ts';
import type { ResolvedOptions } from './options.ts';

const scriptLang =
	/<!--[^]*?-->|<script\s+(?:[^>]*|(?:[^=>'"/]+=(?:"[^"]*"|'[^']*'|[^>\s]+)\s+)*)lang=(["'])?([^"' >]+)\1[^>]*>/g;

export interface Compiled {
	filename: string;
	normalizedFilename: string;
	cssId: string;
	lang: string;
	compiled: CompileResult;
	ssr: boolean;
}

export async function dynamicOptions(
	options: ResolvedOptions,
	filename: string,
	code: string,
	compileOptions: CompileOptions,
	environment: Environment,
	scope: string
): Promise<Partial<CompileOptions> | undefined> {
	const dynamic = await options.dynamicCompileOptions?.({
		filename,
		code,
		compileOptions,
		environment
	});
	if (dynamic && log.debug.enabled) {
		log.debug(
			`dynamic compile options for  ${filename}: ${JSON.stringify(dynamic)}`,
			undefined,
			scope
		);
	}
	return dynamic || undefined;
}

function lang(code: string): string {
	for (const match of code.matchAll(scriptLang)) if (match[2]) return match[2];
	return 'js';
}

export async function compileComponent(
	request: ComponentRequest,
	code: string,
	options: ResolvedOptions,
	environment: Environment,
	sourcemap?: object
): Promise<Compiled> {
	const { filename, normalizedFilename, cssId, ssr, raw, frontEnd } = request;
	const compileOptions: CompileOptions = {
		...options.compilerOptions,
		filename,
		generate: ssr ? 'server' : 'client'
	};
	let source = code;
	if (compileOptions.hmr && options.emitCss) {
		const close = code.lastIndexOf('</style>');
		if (close > -1) source = `${source.slice(0, close)} *{}${source.slice(close)}`;
	}
	const dynamic = await dynamicOptions(
		options,
		filename,
		source,
		compileOptions,
		environment,
		'compile'
	);
	const final: CompileOptions = dynamic ? { ...compileOptions, ...dynamic } : compileOptions;
	if (sourcemap) final.sourcemap = sourcemap;
	let compiled: CompileResult;
	try {
		compiled = frontEnd.compiler.compile(source, { ...final, filename });
		if (
			options.server?.config.experimental.hmrPartialAccept &&
			compiled.js.code.includes('import.meta.hot.accept(')
		) {
			compiled.js.code = compiled.js.code.replaceAll(
				'import.meta.hot.accept(',
				'import.meta.hot.acceptExports(["default"],'
			);
		}
	} catch (error) {
		enhanceCompileError(error as CompileError, code, options.preprocess);
		throw error;
	}
	mapToRelative(compiled.js?.map, filename);
	mapToRelative(compiled.css?.map, filename);
	if (!raw && options.emitCss !== false && (compiled.css?.code?.trim().length ?? 0) > 0) {
		compiled.js.code += `\nimport ${JSON.stringify(cssId)};\n`;
	}
	return { filename, normalizedFilename, cssId, lang: lang(code), compiled, ssr };
}
