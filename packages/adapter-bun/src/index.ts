import type { Adapter } from '@vigla/kit';
import type { Build, CompileBuildOptions } from 'bun';
import { build } from './build.ts';

export interface ServerOptions {
	development?: boolean;
	hostname?: string;
	port?: number | string;
	idleTimeout?: number;
	maxRequestBodySize?: number;
	reusePort?: boolean;
	unix?: string;
	ipv6Only?: boolean;
}

export interface MinifyOptions {
	whitespace?: boolean;
	syntax?: boolean;
	identifiers?: boolean;
}

export interface BuildOptions {
	compile?: boolean | Build.CompileTarget | CompileBuildOptions;
	sourcemap?: 'none' | 'linked' | 'inline' | 'external' | boolean;
	minify?: boolean | MinifyOptions;
	bytecode?: boolean;
	banner?: string;
	footer?: string;
	drop?: string[];
	features?: string[];
	optimizeImports?: string[];
	external?: string[];
}

export interface Options {
	out?: string;
	precompress?: boolean;
	envPrefix?: string;
	serverOptions?: ServerOptions;
	buildOptions?: BuildOptions;
}

export default function adapter(options: Options = {}): Adapter {
	return {
		name: '@vigla/adapter-bun',
		supports: { read: () => true, instrumentation: () => true },
		adapt: (builder) => build(builder, options)
	};
}
