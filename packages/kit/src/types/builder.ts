import type { Plugin } from 'vite';
import type { GetRequest, SetResponse } from './node.ts';
import type { Config } from './config.ts';
import type { Identity } from './identity.ts';
import type { MaybePromise } from './value.ts';

export interface AdapterSupportInput {
	config: Record<string, any>;
	route: { id: string };
}
export interface AdapterSupport {
	read?: (details: AdapterSupportInput) => boolean;
	instrumentation?: () => boolean;
}
export interface AdapterVitePlugins {
	pre?: Plugin[];
	post?: Plugin[];
}
export interface AdapterViteConfig {
	getRequest?: GetRequest;
	setResponse?: SetResponse;
	plugins?: Plugin[] | AdapterVitePlugins;
}
export interface AdapterContext {
	config: ValidatedConfig;
}
export interface Adapter {
	name: string;
	adapt(builder: Builder): MaybePromise<void>;
	supports?: AdapterSupport;
	emulate?: () => MaybePromise<Emulator>;
	vite?: AdapterViteConfig | ((context: AdapterContext) => AdapterViteConfig);
}
export interface EmulationInput {
	config: any;
	prerender: PrerenderOption;
}
export interface Emulator {
	platform?(details: EmulationInput): MaybePromise<App.Platform>;
}
export type PrerenderOption = boolean | 'auto';
export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'QUERY';
export interface RouteSegment {
	content: string;
	dynamic: boolean;
	rest: boolean;
}
export interface RouteDefinition<Config = any> {
	id: string;
	api: { methods: (HttpMethod | '*')[] };
	page: { methods: ('GET' | 'POST')[] };
	pattern: RegExp;
	prerender: PrerenderOption;
	segments: RouteSegment[];
	methods: (HttpMethod | '*')[];
	config: Config;
}
export interface Logger {
	(message: string): void;
	success(message: string): void;
	error(message: string): void;
	warn(message: string): void;
	minor(message: string): void;
	info(message: string): void;
	err(message: string): void;
	prettyError(error: unknown, caller?: string): void;
}
export interface PrerenderedPage {
	file: string;
}
export interface PrerenderedAsset {
	type: string;
}
export interface PrerenderedRedirect {
	status: number;
	location: string;
}
export interface Prerendered {
	pages: Map<string, PrerenderedPage>;
	assets: Map<string, PrerenderedAsset>;
	redirects: Map<string, PrerenderedRedirect>;
	paths: string[];
}
export type RecursiveRequired<T> = {
	[K in keyof T]-?: Extract<T[K], Function | (`${string}:` & {})> extends never
		? RecursiveRequired<T[K]>
		: T[K];
};
export type ValidatedConfig = RecursiveRequired<Omit<Config, 'preprocess' | 'adapter'>> & {
	adapter: Adapter & { vite?: AdapterViteConfig };
	preprocess: Config['preprocess'];
};
export interface ServerInstanceOptions {
	routes?: RouteDefinition[];
	serverDirectory?: string;
}
export interface InitializerOptions {
	outputDirectory: string;
	environment?: string;
	serverDirectory?: string;
}
export interface CopyOptions {
	filter?(basename: string): boolean;
	replace?: Record<string, string>;
}
export interface InstrumentPaths {
	instrumentation: string;
	start: string;
	initializer: string;
}
export type InstrumentModule =
	| { exports: string[] }
	| { generateText(paths: InstrumentPaths): string };
export interface InstrumentOptions {
	entrypoint: string;
	instrumentation: string;
	start?: string;
	initializer: string;
	module?: InstrumentModule;
}
export interface Builder {
	identity: Identity;
	log: Logger;
	rimraf(directory: string): void;
	mkdirp(directory: string): void;
	config: ValidatedConfig;
	prerendered: Prerendered;
	routes: RouteDefinition[];
	manifest: typeof import('$app/manifest');
	mimeTypes: Record<string, string>;
	findServerAssets(routes: RouteDefinition[]): string[];
	generateFallback(destination: string): Promise<void>;
	generateEnvModule(): void;
	getBuildDirectory(name: string): string;
	getClientDirectory(): string;
	getServerDirectory(): string;
	getAppPath(): string;
	generateServerInstance(destination: string, options?: ServerInstanceOptions): void;
	writeClient(destination: string): string[];
	writePrerendered(destination: string): string[];
	writeServer(destination: string): string[];
	createInstrumentationInitializer(options: InitializerOptions): string;
	copy(from: string, to: string, options?: CopyOptions): string[];
	hasServerInstrumentationFile(): boolean;
	instrument(options: InstrumentOptions): void;
	compress(directory: string): Promise<string[]>;
}
