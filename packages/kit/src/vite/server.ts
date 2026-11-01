import path from 'node:path';
import { uneval } from 'devalue';
import { loadErrorPage, loadTemplate } from '../config/index.ts';
import { escapeHtml } from '../shared/escape.ts';
import type { ValidatedConfig } from '../types/builder.ts';
import type { Project } from './project.ts';
import { ids, nodeId } from './ids.ts';
import { resolveEntry } from '../sync/index.ts';
import { fileUrl, moduleUrl, packageDirectory, posix } from './paths.ts';

export function serverEntry(name: string, dev: boolean): string {
	return `import { Server as Runtime } from ${JSON.stringify(`${name}/internal/server`)};
import { options } from ${JSON.stringify(ids.options)};
export { options };
${dev ? `export { manifest } from ${JSON.stringify(ids.manifest)};` : ''}
export class Server extends Runtime { constructor(manifest) { super(manifest, { ...options, remote: async (call) => { await manifest.remotes[call.id]?.(); const { handleRemote } = await import(${JSON.stringify(name + '/internal/server')}); return handleRemote(call); } }); } }`;
}

function templateExpression(template: string, expressions: Record<string, string>): string {
	const parts: string[] = [];
	let offset = 0;
	for (const match of template.matchAll(/%sveltekit\.([^%]+)%/g)) {
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

export function errorTemplate(config: ValidatedConfig): string {
	return `export default ({ status, message }) => ${templateExpression(loadErrorPage(config), { status: 'status', 'error.message': 'message' })};`;
}

export function serverOptions(project: Project): string {
	const { config, tree, root, format } = project;
	const dev = project.vite.command === 'serve';
	const template = loadTemplate(root, config);
	const app = templateExpression(template, {
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
root, format: ${uneval(format)}, global: ${JSON.stringify(project.global)},
appTemplateContainsNonce: ${template.includes('%sveltekit.nonce%')},
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

export function serverManifest(project: Project): string {
	const { config, tree, root } = project;
	const absolute = (file: string) => JSON.stringify(posix(path.resolve(root, file)));
	const nodes = tree.nodes.map((node, index) => {
		const component = node.component
			? absolute(node.component)
			: JSON.stringify(index === 1 ? ids.error : ids.layout);
		const universal = node.universal
			? node.options?.ssr === false
				? uneval(node.options)
				: `await import(${absolute(node.universal)})`
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
client: ${uneval({ start: fileUrl(path.join(packageDirectory, 'src/entries/internal/client.ts')), app: fileUrl(ids.client), imports: [], stylesheets: [], fonts: [], uses_env_dynamic_public: true, nodes: config.router.resolution === 'server' ? tree.nodes.map((_, index) => moduleUrl(nodeId(project, index), root)) : undefined, routes: clientRoutes })},
nodes: [${nodes.join(',\n')}], routes: [${routes.join(',\n')}], remotes: {${[...project.remote.entries].map(([id, entry]) => `${JSON.stringify(id)}: () => import(${absolute(entry.file)}).then(module => ({ default: module }))`).join(',')}}, prerendered_routes: new Set(), server_assets: {},
async matchers() { return ${tree.params && hasMatchers ? `(await import(${absolute(tree.params)})).params` : '{}'}; }
};`;
}
