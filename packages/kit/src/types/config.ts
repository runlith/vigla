/// <reference path="../../types/index.d.ts" preserve="true" />
import type { Options } from '@vigla/vite-plugin';
import type { Plugin } from 'vite';
import type { Adapter } from './builder.ts';
import type { CspConfig } from './csp.ts';

export interface CsrfConfig {
	checkOrigin?: boolean;
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
	preloadStrategy?: 'modulepreload' | 'preload-js' | 'preload-mjs';
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
export type ExperimentalConfig = Options['experimental'] & {
	remoteFunctions?: boolean;
	forkPreloads?: boolean;
};
export interface Config extends Omit<Options, 'experimental'> {
	adapter?: Adapter;
	alias?: Record<string, string>;
	appDir?: string;
	csp?: CspConfig;
	csrf?: CsrfConfig;
	embedded?: boolean;
	env?: EnvironmentConfig;
	experimental?: ExperimentalConfig;
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
export declare function sveltekit(config?: Config): Promise<Plugin[]>;
