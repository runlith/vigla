import type { Component, Exports } from 'vigla';
import type { Format } from 'vigla/compiler';
import type { ClientInit, HandleClientError, Reroute, Transport } from '../hooks.ts';
import type { Load, Snapshot } from '../request.ts';
import type { Page } from '../state.ts';
import type { ParamMatcher, ParamValue } from '../params.ts';
import type { DataNode, TrailingSlash } from './data.ts';

export type MatchedParams = Record<string, ParamValue>;

export interface UniversalNode {
	load?: Load;
	trailingSlash?: TrailingSlash;
	ssr?: boolean;
	csr?: boolean;
	prerender?: boolean | 'auto';
}

export interface ClientNode {
	component: Component<any, any>;
	universal?: UniversalNode;
	imports?: string[];
	stylesheets?: string[];
}

export type NodeLoader = () => Promise<ClientNode>;
export type RouteDictionary = Record<
	string,
	[leaf: number, layouts: Array<number | undefined>, errors?: Array<number | undefined>]
>;
export type NodeReference = [hasServerLoad: boolean, node: number];

export interface ServerRoute {
	id: string;
	errors: Array<number | undefined>;
	layouts: Array<NodeReference | undefined>;
	leaf: NodeReference;
	nodes: Record<string, NodeLoader>;
}

export interface ClientHooks {
	init?: ClientInit;
	handleError?: HandleClientError;
	reroute?: Reroute;
	transport?: Transport;
}

export interface RenderNode {
	component: Component<any, any>;
	error?: Component<any, any>;
	data: Record<string, any>;
	child: RenderNode | null;
}

export interface ComponentInstance extends Exports {
	snapshot?: Snapshot;
}

export interface RootProps extends Record<string, unknown> {
	page: Page<MatchedParams>;
	components: ComponentInstance[];
	onerror: (error: unknown, reset: () => void) => void;
	tree: RenderNode;
	form: Record<string, any> | null;
	error: App.Error | null;
}

export interface ClientPayload {
	hash?: boolean;
	base?: string;
	assets?: string;
	app_dir?: string;
	app_path?: string;
	env?: Record<string, unknown>;
	version?: string;
	version_poll_interval?: number;
	embedded?: boolean;
}

export interface ClientApp {
	global: string;
	nodes: NodeLoader[];
	serverLoads: number[];
	dictionary: RouteDictionary;
	matchers: Record<string, ParamMatcher>;
	hooks: ClientHooks;
	root: Component<RootProps, any>;
	format?: Format;
	clientRouting?: boolean;
	versionChecks?: boolean;
	encoders: Record<string, (value: any) => false | any>;
	decoders: Record<string, (value: any) => any>;
	decode?: (type: string, value: any) => any;
	errorTemplate?: () => Promise<(data: { status: number; message: string }) => string>;
}

export type Hydration = () => HydrationPayload;
export type ChunkDecoder = (app: ClientApp) => [data?: unknown, error?: unknown];

export interface ClientGlobal extends ClientPayload {
	ready?: Promise<void>;
	defer(id: number): Promise<unknown>;
	resolve(id: number, decode: ChunkDecoder): void;
}

export interface HydrationPayload {
	status?: number;
	error: App.Error | null;
	node_ids: number[];
	params: MatchedParams;
	route: { id: string | null };
	server_route?: ServerRoute;
	data: Array<DataNode | null>;
	form: Record<string, any> | null;
	remote?: Record<string, any>;
}
