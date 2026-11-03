import { basename, combine } from 'vigla/compiler';
import type { Environment } from 'vite';
import type { CompileError, CompileOptions, CompileResult } from './compiler.ts';
import { enhanceCompileError } from './error.ts';
import type { ComponentRequest } from './id.ts';
import type { Log } from './log.ts';
import { mapToRelative } from './maps.ts';
import type { ResolvedOptions } from './options.ts';

export interface Compiled {
	filename: string;
	normalizedFilename: string;
	cssId: string;
	compiled: CompileResult;
	ssr: boolean;
}

export async function dynamicOptions(
	options: ResolvedOptions,
	filename: string,
	code: string,
	compileOptions: CompileOptions,
	environment: Environment,
	log: Log,
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

export async function compileComponent(
	request: ComponentRequest,
	code: string,
	options: ResolvedOptions,
	environment: Environment,
	log: Log,
	sourcemap?: object
): Promise<Compiled> {
	const { filename, normalizedFilename, cssId, ssr, raw, frontEnd } = request;
	const compileOptions: CompileOptions = {
		...options.compilerOptions,
		filename,
		generate: ssr ? 'server' : 'client'
	};
	const dynamic = await dynamicOptions(
		options,
		filename,
		code,
		compileOptions,
		environment,
		log,
		'compile'
	);
	const final: CompileOptions = dynamic ? { ...compileOptions, ...dynamic } : compileOptions;
	delete final.sourcemap;
	let compiled: CompileResult;
	try {
		compiled = frontEnd.compiler.compile(code, { ...final, filename });
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
	if (compiled.css?.map && sourcemap) {
		compiled.css.map = combine(basename(filename), [compiled.css.map, sourcemap] as Parameters<
			typeof combine
		>[1]) as typeof compiled.css.map;
	}
	mapToRelative(compiled.js?.map, filename);
	mapToRelative(compiled.css?.map, filename);
	if (!raw && options.emitCss !== false && (compiled.css?.code?.trim().length ?? 0) > 0) {
		compiled.js.code += `\nimport ${JSON.stringify(cssId)};\n`;
	}
	return { filename, normalizedFilename, cssId, compiled, ssr };
}
