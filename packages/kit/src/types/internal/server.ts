import type { Attributes, Span } from '@opentelemetry/api';
import type { Owner } from 'vigla';
import type { Component, Format } from 'vigla/server';
import type { CspConfig } from '../csp.ts';
import type { Emulator, PrerenderOption } from '../builder.ts';
import type {
	Handle,
	HandleFetch,
	HandleServerError,
	Reroute,
	ResolveOptions,
	ServerInit,
	Transport
} from '../hooks.ts';
import type { ParamMatcher, ParamValue } from '../params.ts';
import type {
	Actions,
	Load,
	RequestEvent,
	RequestHandler,
	Server,
	ServerInitOptions,
	ServerLoad
} from '../request.ts';
import type { Page } from '../state.ts';
import type { MaybePromise } from '../value.ts';
import type { PageBranch, RouteParam } from './routes.ts';
import type { TrailingSlash } from './data.ts';
import type { RemoteExport, RemoteRequestState } from './remote.ts';

export type { TrailingSlash } from './data.ts';
export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'QUERY';
export type Read = (file: string) => MaybePromise<ReadableStream<Uint8Array> | null>;

export interface AsyncContext {
	run<T>(store: RequestStore, fn: () => T): T;
	getStore(): RequestStore | undefined;
}

export interface FontDependency {
	file: string;
	filename: string;
}

export interface UniversalNode {
	load?: Load<Record<string, ParamValue>>;
	prerender?: PrerenderOption;
	ssr?: boolean;
	csr?: boolean;
	trailingSlash?: TrailingSlash;
	config?: Record<string, any>;
	entries?: EntryGenerator;
}

export interface ServerNode {
	load?: ServerLoad<Record<string, ParamValue>>;
	prerender?: PrerenderOption;
	ssr?: boolean;
	csr?: boolean;
	trailingSlash?: TrailingSlash;
	actions?: Actions<Record<string, ParamValue>>;
	config?: Record<string, any>;
	entries?: EntryGenerator;
}

export type EntryGenerator = () => MaybePromise<Array<Record<string, string>>>;
export type ComponentLoader = () => Promise<Component<any>>;
export type NodeLoader = () => Promise<PageNode>;

export type Style = (assets: string, base: string) => string;

export interface PageNode {
	index: number;
	imports: string[];
	stylesheets: string[];
	fonts: FontDependency[];
	universal_id?: string;
	server_id?: string;
	inline_styles?(): MaybePromise<Record<string, string | Style>>;
	component?: ComponentLoader;
	universal?: UniversalNode;
	server?: ServerNode;
}

export type Endpoint = Partial<Record<HttpMethod, RequestHandler<Record<string, ParamValue>>>> & {
	prerender?: PrerenderOption;
	trailingSlash?: TrailingSlash;
	config?: Record<string, any>;
	entries?: EntryGenerator;
	fallback?: RequestHandler<Record<string, ParamValue>>;
};

export interface ServerRoute {
	id: string;
	pattern: RegExp;
	params: RouteParam[];
	page: PageBranch | null;
	endpoint: (() => Promise<Endpoint>) | null;
	endpoint_id?: string;
}

export interface ClientRoute {
	id: string;
	pattern: RegExp;
	params: RouteParam[];
	errors: Array<number | undefined>;
	layouts: Array<[has_server_load: boolean, node_id: number] | undefined>;
	leaf: [has_server_load: boolean, node_id: number];
}

export interface ClientBuild {
	start: string;
	app?: string;
	imports: string[];
	nodes?: Array<string | undefined>;
	css?: Array<string[] | undefined>;
	routes?: ClientRoute[];
	stylesheets: string[];
	fonts: FontDependency[];
	uses_env_dynamic_public: boolean;
	inline?: { script: string; style: Style | undefined };
}

export interface RemoteModule {
	default: Record<string, RemoteExport>;
}

export interface ServerManifest {
	app_dir: string;
	app_path: string;
	assets: Set<string>;
	mime_types: Record<string, string>;
	client: ClientBuild | null;
	nodes: NodeLoader[];
	remotes: Record<string, () => Promise<RemoteModule>>;
	routes: ServerRoute[];
	prerendered_routes: Set<string>;
	matchers(): Promise<Record<string, ParamMatcher>>;
	server_assets: Record<string, number>;
}

export interface ServerHooks {
	handle?: Handle;
	handleFetch?: HandleFetch;
	handleError?: HandleServerError;
	reroute?: Reroute;
	transport?: Transport;
	init?: ServerInit;
}

export interface AppTemplateValues {
	head: string;
	body: string;
	assets: string;
	nonce: string;
	env: Record<string, unknown>;
}

export interface ErrorTemplateValues {
	message: string;
	status: number;
}

export interface ServerTemplates {
	app(values: AppTemplateValues): string;
	error(values: ErrorTemplateValues): string;
}

export interface ServerPaths {
	base: string;
	assets: string;
	origin?: string;
	relative: boolean;
}

export interface Environment {
	public: Record<string, unknown>;
	private: Record<string, unknown>;
	rendered: Record<string, unknown>;
}

export interface ServerEnvironment {
	set(values: Record<string, string | undefined>): MaybePromise<Environment>;
}

export interface ServerVersion {
	name: string;
	pollInterval: number;
}

export interface ServerOutput {
	bundleStrategy: 'split' | 'single' | 'inline';
	linkHeaderPreload: boolean;
}

export interface ServerRouter {
	type: 'pathname' | 'hash';
	resolution: 'client' | 'server';
}

export interface RemoteCall {
	id: string;
	name: string;
	argument?: string;
	store: RequestStore;
}

export interface ServerCsrf {
	checkOrigin: boolean;
	trustedOrigins: string[];
}

export interface ServerWorker {
	file: string;
	options: RegistrationOptions;
}

export interface ServerTracing {
	server: boolean;
}

export interface ServerOptions {
	global: string;
	root: Component<any>;
	format?: Format;
	getHooks(): Promise<ServerHooks>;
	templates: ServerTemplates;
	appTemplateContainsNonce: boolean;
	csp: CspConfig;
	csrf: ServerCsrf;
	paths: ServerPaths;
	env: ServerEnvironment;
	serviceWorker: ServerWorker | null;
	version: ServerVersion;
	output: ServerOutput;
	router: ServerRouter;
	embedded: boolean;
	tracing: ServerTracing;
	dev: boolean;
	building: boolean;
	prerendering: boolean;
	fixStack?(error: Error): Error;
	remote?(call: RemoteCall): Promise<Response>;
}

export interface Uses {
	dependencies: Set<string>;
	params: Set<string>;
	parent: boolean;
	route: boolean;
	url: boolean;
	search_params: Set<string>;
}

export interface ServerDataNode {
	type: 'data';
	data: Record<string, any> | null;
	uses: Uses;
	slash?: TrailingSlash;
}

export interface Fetched {
	url: string;
	method: string;
	request_headers?: Headers;
	request_body?: string | ArrayBufferView;
	response: Response;
	response_body: string;
	is_b64: boolean;
}

export interface PrerenderDependency {
	response: Response;
	body: string | Uint8Array | null;
}

export interface PrerenderState {
	fallback: boolean;
	insideReroute: boolean;
	dependencies: Map<string, PrerenderDependency>;
	remoteResponses?: Map<string, Promise<any>>;
}

export interface RespondOptions {
	getClientAddress(): string;
	platform?: App.Platform;
	emulator?: Emulator;
	read?: Read;
	prerendering?: PrerenderState;
}

export interface ServerInstance {
	init(options: ServerInitOptions): Promise<void>;
	respond(request: Request, options: RespondOptions): Promise<Response>;
}

export interface ServerConfigureOptions {
	manifest?: ServerManifest;
	env?: Record<string, string | undefined>;
	read?: Read;
	scope?: AsyncContext;
	assets?: string;
	building?: boolean;
	prerendering?: boolean;
	fix_stack_trace?(error: Error): void;
}

export interface ConfiguredServer {
	init(): Promise<void>;
	respond(request: Request, options: RespondOptions): Promise<Response>;
	set_env(env: Record<string, string | undefined>): void;
}

export interface ServerModule {
	configure(options: ServerConfigureOptions): Promise<ConfiguredServer>;
	create_server(manifest: ServerManifest): Server;
	Server: new (manifest: ServerManifest) => Server;
	format_response(status: number, request: Request): string;
}

export interface ServerInternalModule {
	options: ServerOptions;
}

export interface RequestState {
	read?: Read;
	emulator?: Emulator;
	depth: number;
	error: boolean;
	rerouted: string | null;
	prerendering?: PrerenderState;
	prerenderDefault?: PrerenderOption;
	prerenderCache?: string;
	fetched: Fetched[];
	resolveOptions: ResolveOptions;
	isRendering: boolean;
	active: boolean;
}

export interface RequestStore {
	event: RequestEvent<Record<string, ParamValue>>;
	state: RequestState;
	owner: Owner;
	manifest: ServerManifest;
	options: ServerOptions;
	environment: Environment;
	hooks: ServerHooks;
	tracer: SpanRecorder;
	scope?: AsyncContext;
	remote: RemoteRequestState;
}

export interface SpanRecorder {
	span<T>(name: string, attributes: Attributes, fn: (span: Span) => Promise<T>): Promise<T>;
}

export interface RenderBranch {
	component: Component<any>;
	error: Component<any> | null;
	data: Record<string, any>;
	child: RenderBranch | null;
}

export interface RootProps extends Record<string, unknown> {
	page: Page<Record<string, ParamValue>>;
	tree: RenderBranch;
	form: unknown;
	error: App.Error | null;
	components: unknown[];
	onerror(error: unknown): void;
}

export interface MatchedRoute {
	route: ServerRoute;
	params: Record<string, ParamValue>;
}
