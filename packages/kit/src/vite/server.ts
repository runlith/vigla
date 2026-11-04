import path from 'node:path';
import { uneval } from 'devalue';
import { loadErrorPage, loadTemplate } from '../config/index.ts';
import { escapeHtml } from '../shared/escape.ts';
import type { PageNode } from '../types/internal/routes.ts';
import type { Project } from './project.ts';
import { ids, nodeId } from './ids.ts';
import { resolveEntry } from '../sync/index.ts';
import { codeFile, fileUrl, moduleUrl, posix } from './paths.ts';

export function serverEntry(name: string, dev: boolean): string {
	return `import { Server as Runtime } from ${JSON.stringify(`${name}/internal/server`)};
${dev ? `import { manifest as developmentManifest } from ${JSON.stringify(ids.manifest)}; export { developmentManifest as manifest };` : ''}
let active, configured, ready;
export async function configure(input) {
const { options } = await import(${JSON.stringify(ids.options)});
const { updateEnv, values } = await import(${JSON.stringify(ids.env)});
const manifest = input.manifest ?? active?.manifest${dev ? ' ?? developmentManifest' : ''};
if (!manifest) throw new Error('A server manifest is required before application initialization');
if (!active || active.manifest !== manifest) {
const state = { ...options, paths: { ...options.paths }, building: !!input.building, prerendering: !!input.prerendering };
if (input.assets !== undefined) state.paths.assets = input.assets;
if (input.fix_stack_trace) state.fixStack = error => { input.fix_stack_trace(error); return error; };
const server = new Runtime(manifest, { ...state, remote: async call => { await manifest.remotes[call.id]?.(); const { handleRemote } = await import(${JSON.stringify(name + '/internal/server')}); return handleRemote(call); } });
const initialization = { env: input.env ?? values, read: input.read, scope: input.scope };
active = server;
configured = { init: () => server.init(initialization), respond: (request, options) => server.respond(request, options), set_env: env => { updateEnv(env); } };
ready = server.configure(initialization);
} else {
if (input.building) active.options.building = true;
if (input.prerendering) active.options.prerendering = true;
if (input.assets !== undefined) active.options.paths.assets = input.assets;
if (input.fix_stack_trace) active.options.fixStack = error => { input.fix_stack_trace(error); return error; };
await ready;
if (input.env) await active.setEnv(input.env);
}
const result = configured;
await ready;
return result;
}
export function create_server(manifest) {
let server;
return { async init(options) { server = await configure({ ...options, manifest }); await server.init(); }, respond(request, options) { return server.respond(request, options); } };
}
export class Server {
constructor(manifest) { this.server = create_server(manifest); }
init(options) { return this.server.init(options); }
respond(request, options) { return this.server.respond(request, options); }
}
export function format_response(status, request) { const url = new URL(request.url); return status + ' ' + request.method + ' ' + url.href.slice(url.origin.length); }`;
}

function templateExpression(
	name: string,
	template: string,
	expressions: Record<string, string>
): string {
	const parts: string[] = [];
	let offset = 0;
	for (const match of template.matchAll(new RegExp(`%${name}\\.([^%]+)%`, 'g'))) {
		const token = match[1]!;
		const expression =
			expressions[token] ??
			(token.startsWith('env.') ? `(env[${JSON.stringify(token.slice(4))}] ?? '')` : undefined);
		if (expression === undefined) continue;
		parts.push(JSON.stringify(template.slice(offset, match.index)), expression);
		offset = match.index + match[0].length;
	}
	parts.push(JSON.stringify(template.slice(offset)));
	return parts.join(' + ');
}

export function errorTemplate(project: Project): string {
	const { config, diagnostics, identity } = project;
	return `export default ({ status, message }) => ${templateExpression(identity.name, loadErrorPage(config, diagnostics), { status: 'status', 'error.message': 'message' })};`;
}

export function serverOptions(project: Project): string {
	const { config, tree, root, format } = project;
	const dev = project.vite.command === 'serve';
	const template = loadTemplate(root, config, project.diagnostics);
	const app = templateExpression(project.identity.name, template, {
		head: dev
			? `head + ${JSON.stringify(`<script type="module" src="${config.paths.base}/@vite/client"></script>`)}`
			: 'head',
		body: 'body',
		assets: 'assets',
		nonce: 'nonce',
		version: JSON.stringify(escapeHtml(config.version.name))
	});
	const worker = resolveEntry(config.files.serviceWorker, config.moduleExtensions);
	return `import root from ${JSON.stringify(ids.root)};
import error from ${JSON.stringify(ids.errorTemplate)};
import { setEnv } from ${JSON.stringify(ids.env)};
export const options = {
root, format: ${uneval(format)}, extension: ${uneval(config.extensions[0] ?? '')}, adapter: ${uneval(config.adapter?.name ?? '')}, global: ${JSON.stringify(project.global)},
appTemplateContainsNonce: ${template.includes(`%${project.identity.name}.nonce%`)},
csp: ${uneval(config.csp)},
csrf: ${uneval({ checkOrigin: !config.csrf.trustedOrigins.includes('*'), trustedOrigins: config.csrf.trustedOrigins })},
paths: ${uneval(config.paths)}, env: { set: setEnv },
serviceWorker: ${uneval(config.serviceWorker.register && worker ? { file: 'service-worker.js', options: config.serviceWorker.options ?? {} } : null)},
version: ${uneval({ name: config.version.name, pollInterval: dev ? 0 : config.version.pollInterval })},
output: ${uneval(config.output)}, router: ${uneval(config.router)}, embedded: ${config.embedded},
tracing: ${uneval(config.tracing)}, dev: ${dev}, building: false, prerendering: false,
templates: { app: ({ head, body, assets, nonce, env }) => ${app}, error },
async getHooks() {
const server = ${tree.hooks.server ? `await import(${JSON.stringify(posix(path.resolve(root, tree.hooks.server)))})` : '{}'};
const universal = ${tree.hooks.universal ? `await import(${JSON.stringify(posix(path.resolve(root, tree.hooks.universal)))})` : '{}'};
return { handle: server.handle, handleFetch: server.handleFetch, handleError: server.handleError, init: server.init, reroute: universal.reroute, transport: universal.transport };
}
};`;
}

export function importsUniversal(node: PageNode | undefined): boolean {
	return !!node?.universal && node.options?.ssr !== false;
}

export function serverManifest(project: Project): string {
	const { config, tree, root } = project;
	const absolute = (file: string) => JSON.stringify(posix(path.resolve(root, file)));
	const nodes = tree.nodes.map((node, index) => {
		const component = node.component
			? absolute(node.component)
			: JSON.stringify(index === 1 ? ids.error : ids.layout);
		const universal = importsUniversal(node)
			? `await import(${absolute(node.universal!)})`
			: node.universal
				? uneval(node.options)
				: 'undefined';
		return `async () => ({ index: ${index}, imports: [], stylesheets: [], fonts: [], component: () => import(${component}).then(module => module.default), universal: ${universal}, server: ${node.server ? `await import(${absolute(node.server)})` : 'undefined'}, universal_id: ${uneval(node.universal)}, server_id: ${uneval(node.server)} })`;
	});
	const routes = tree.routes
		.filter((route) => route.page || route.endpoint)
		.map(
			(route) => `{
id: ${JSON.stringify(route.id)}, pattern: ${route.pattern}, params: ${uneval(route.params)}, page: ${uneval(route.page)},
endpoint: ${route.endpoint ? `() => import(${absolute(route.endpoint.file)})` : 'null'}, endpoint_id: ${uneval(route.endpoint?.file)}
}`
		);
	const clientRoutes =
		config.router.resolution === 'server'
			? tree.routes
					.filter((route) => route.page)
					.map((route) => ({
						id: route.id,
						pattern: route.pattern,
						params: route.params,
						errors: route.page!.errors,
						layouts: route.page!.layouts.map((index) =>
							index === undefined ? undefined : [!!tree.nodes[index]?.server, index]
						),
						leaf: [!!tree.nodes[route.page!.leaf]?.server, route.page!.leaf]
					}))
			: undefined;
	const hasMatchers = tree.routes.some((route) => route.params.some((param) => param.matcher));
	const mimeTypes = Object.fromEntries(
		tree.assets.filter((asset) => asset.type).map((asset) => [path.extname(asset.file), asset.type])
	);
	return `export const manifest = {
app_dir: ${JSON.stringify(config.appDir)}, app_path: ${JSON.stringify([config.paths.base.slice(1), config.appDir].filter(Boolean).join('/'))},
assets: new Set(${uneval(tree.assets.map((asset) => asset.file))}), mime_types: ${uneval(mimeTypes)},
client: ${uneval({ start: fileUrl(codeFile('entries/internal/client')), app: fileUrl(ids.client), imports: [], stylesheets: [], fonts: [], uses_env_dynamic_public: true, nodes: config.router.resolution === 'server' ? tree.nodes.map((_, index) => moduleUrl(nodeId(project, index), root)) : undefined, routes: clientRoutes })},
nodes: [${nodes.join(',\n')}], routes: [${routes.join(',\n')}], remotes: {}, prerendered_routes: new Set(), server_assets: {},
async matchers() { return ${tree.params && hasMatchers ? `(await import(${absolute(tree.params)})).params` : '{}'}; }
};`;
}
