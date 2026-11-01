import type {
	HttpMethod,
	Logger,
	Prerendered,
	PrerenderOption,
	ValidatedConfig
} from '../types/builder.ts';
import type { Route, RouteTree } from '../types/internal/routes.ts';
import type { ClientBuild, FontDependency, Style } from '../types/internal/server.ts';

export type AppManifest = typeof import('$app/manifest');

export interface Chunk {
	file: string;
	imports: string[];
	assets: string[];
}

export interface BuiltNode {
	component: string;
	universal?: string;
	server?: string;
	imports: string[];
	stylesheets: string[];
	fonts: FontDependency[];
	inlineStyles?: Record<string, string>;
}

export interface CompiledStyle {
	source: string;
	render: Style;
}

export interface Artifacts {
	client: ClientBuild | null;
	nodes: BuiltNode[];
	endpoints: Record<string, string>;
	matchers: string | null;
	remotes: Record<string, string>;
	chunks: Record<string, Chunk>;
	serviceWorker: string | null;
	inlineStyle?: CompiledStyle;
}

export interface NodeMetadata {
	hasServerLoad: boolean;
	hasUniversalLoad: boolean;
}

export interface RouteMetadata {
	config: Record<string, any>;
	methods: Array<HttpMethod | '*'>;
	page: { methods: Array<'GET' | 'POST'> };
	api: { methods: Array<HttpMethod | '*'> };
	prerender: PrerenderOption;
	entries?: string[];
}

export interface RemoteMetadata {
	type: string;
	dynamic: boolean;
}

export interface Analysis {
	nodes: NodeMetadata[];
	routes: Map<string, RouteMetadata>;
	remotes: Map<string, Map<string, RemoteMetadata>>;
	environment: Record<string, unknown>;
}

export interface BuildContext {
	config: ValidatedConfig;
	root: string;
	mode: string;
	tree: RouteTree;
	artifacts: Artifacts;
	analysis: Analysis;
	prerendered: Prerendered;
	prerenderMap: Map<string, PrerenderOption>;
	manifest: AppManifest;
	environment: Record<string, string | undefined>;
	log: Logger;
}

export interface ManifestInput {
	context: BuildContext;
	routes: Route[];
	relativePath: string;
}
