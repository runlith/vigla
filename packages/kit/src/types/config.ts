/// <reference path="../../types/index.d.ts" preserve="true" />
import type { Options, PluginFactory } from '@vigla/vite-plugin';
import type { Plugin } from 'vite';
import type { Adapter } from './builder.ts';
import type { CspConfig } from './csp.ts';
import type { Identity } from './identity.ts';

export interface CsrfConfig {
	trustedOrigins?: string[];
}
export interface EnvironmentConfig {
	dir?: string;
}
export interface HookFiles {
	client?: string;
	server?: string;
	universal?: string;
}
export interface ProjectFiles {
	src?: string;
	assets?: string;
	hooks?: HookFiles;
	params?: string;
	routes?: string;
	serviceWorker?: string;
	appTemplate?: string;
	errorTemplate?: string;
}
export interface OutputConfig {
	linkHeaderPreload?: boolean;
	bundleStrategy?: 'split' | 'single' | 'inline';
}
export interface PathsConfig {
	assets?: '' | `http://${string}` | `https://${string}`;
	base?: '' | `/${string}`;
	origin?: string;
	relative?: boolean;
}
export interface PrerenderHttpError {
	status: number;
	path: string;
	referrer: string | null;
	referenceType: 'linked' | 'fetched';
	message: string;
}
export interface PrerenderMissingId {
	path: string;
	id: string;
	referrers: string[];
	message: string;
}
export interface PrerenderEntryMismatch {
	generatedFromId: string;
	entry: string;
	matchedId: string;
	message: string;
}
export interface PrerenderUnseenRoutes {
	routes: string[];
	message: string;
}
export interface PrerenderInvalidUrl {
	href: string;
	referrer: string | null;
	message: string;
}
export type PrerenderPolicy<T> = 'fail' | 'warn' | 'ignore' | ((details: T) => void);
export interface PrerenderConfig {
	concurrency?: number;
	crawl?: boolean;
	entries?: ('*' | `/${string}`)[];
	handleHttpError?: PrerenderPolicy<PrerenderHttpError>;
	handleMissingId?: PrerenderPolicy<PrerenderMissingId>;
	handleEntryGeneratorMismatch?: PrerenderPolicy<PrerenderEntryMismatch>;
	handleUnseenRoutes?: PrerenderPolicy<PrerenderUnseenRoutes>;
	handleInvalidUrl?: PrerenderPolicy<PrerenderInvalidUrl>;
}
export interface RouterConfig {
	type?: 'pathname' | 'hash';
	resolution?: 'client' | 'server';
}
export type ServiceWorkerConfig =
	| { register: true; options?: RegistrationOptions }
	| { register?: false };
export interface TracingConfig {
	server?: boolean;
}
export interface TypescriptConfig {
	config?: (config: Record<string, any>) => Record<string, any> | void;
}
export interface VersionConfig {
	name?: string;
	pollInterval?: number;
}
export type ExperimentalConfig<O extends object = Options> = (O extends {
	experimental?: infer E;
}
	? NonNullable<E>
	: {}) & {
	remoteFunctions?: boolean;
	forkPreloads?: boolean;
};
export interface FrameworkConfig {
	adapter?: Adapter;
	alias?: Record<string, string>;
	appDir?: string;
	csp?: CspConfig;
	csrf?: CsrfConfig;
	embedded?: boolean;
	env?: EnvironmentConfig;
	files?: ProjectFiles;
	inlineStyleThreshold?: number;
	moduleExtensions?: string[];
	outDir?: string;
	output?: OutputConfig;
	paths?: PathsConfig;
	prerender?: PrerenderConfig;
	router?: RouterConfig;
	serviceWorker?: ServiceWorkerConfig;
	tracing?: TracingConfig;
	typescript?: TypescriptConfig;
	version?: VersionConfig;
}
export type Config<O extends object = Options> = Omit<O, 'experimental' | keyof FrameworkConfig> &
	FrameworkConfig & { experimental?: ExperimentalConfig<O> };
export type Framework<O extends object = Options> = (config?: Config<O>) => Promise<Plugin[]>;
export type { Identity, Links } from './identity.ts';
export declare function createKit<O extends object>(
	identity: Identity,
	factory: PluginFactory<O>
): Framework<O>;
export declare const kit: Framework;
