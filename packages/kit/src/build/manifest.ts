import { statSync } from 'node:fs';
import path from 'node:path';
import { uneval } from 'devalue';
import { lookup } from '../shared/mime.ts';
import type { Route } from '../types/internal/routes.ts';
import { posix, write } from './files.ts';
import type { BuildContext, ManifestInput } from './types.ts';

export function serverAssets(context: BuildContext, routes: Route[]): string[] {
	const roots = ['index.js'];
	for (const route of routes) {
		if (route.endpoint) roots.push(context.artifacts.endpoints[route.id]!);
		if (route.page)
			for (const index of [...route.page.layouts, ...route.page.errors, route.page.leaf]) {
				if (index === undefined) continue;
				const node = context.artifacts.nodes[index]!;
				roots.push(
					node.component,
					...[node.server, node.universal].filter((file): file is string => !!file)
				);
			}
	}
	const visited = new Set<string>();
	const assets = new Set<string>();
	function visit(file: string): void {
		if (visited.has(file)) return;
		visited.add(file);
		const chunk = context.artifacts.chunks[file];
		if (!chunk) return;
		for (const asset of chunk.assets) assets.add(asset);
		for (const dependency of chunk.imports) visit(dependency);
	}
	roots.forEach(visit);
	return [...assets].sort();
}

export function manifestSource({ context, routes, relativePath }: ManifestInput): string {
	const selected = routes;
	const used = new Set([0, 1]);
	for (const route of selected)
		if (route.page) {
			for (const node of [...route.page.layouts, ...route.page.errors, route.page.leaf])
				if (node !== undefined) used.add(node);
		}
	const indices = [...used].sort((a, b) => a - b);
	const reindex = new Map(indices.map((index, next) => [index, next]));
	const location = (file: string) => {
		const relative = posix(path.posix.join(relativePath, file));
		return relative.startsWith('./') || relative.startsWith('../') ? relative : './' + relative;
	};
	const load = (file: string) => `memo(() => import(${JSON.stringify(location(file))}))`;
	const page = (route: Route) =>
		route.page
			? {
					layouts: route.page.layouts.map((index) =>
						index === undefined ? undefined : reindex.get(index)
					),
					errors: route.page.errors.map((index) =>
						index === undefined ? undefined : reindex.get(index)
					),
					leaf: reindex.get(route.page.leaf)
				}
			: null;
	const client = uneval(context.artifacts.client, (value) =>
		context.artifacts.inlineStyle && value === context.artifacts.inlineStyle.render
			? context.artifacts.inlineStyle.source
			: undefined
	);
	const assets = [
		...context.tree.assets.map((asset) => asset.file),
		...[context.artifacts.serviceWorker].filter((file): file is string => !!file)
	];
	const mime = Object.fromEntries(
		context.tree.assets
			.filter((asset) => asset.type)
			.map((asset) => [path.extname(asset.file), asset.type])
	);
	const files: Record<string, number> = {};
	for (const file of serverAssets(context, routes)) {
		files[file] = statSync(path.join(context.config.outDir, 'output/server', file)).size;
		mime[path.extname(file)] ??= lookup(file) ?? '';
	}
	for (const pathname of context.prerendered.paths)
		if (path.extname(pathname)) mime[path.extname(pathname)] ??= lookup(pathname) ?? '';
	return `(() => { const memo = (load) => { let value; return () => value ??= load(); }; return {
app_dir: ${uneval(context.config.appDir)}, app_path: ${uneval([context.config.paths.base.slice(1), context.config.appDir].filter(Boolean).join('/'))},
assets: new Set(${uneval(assets)}), mime_types: ${uneval(mime)}, client: ${client},
nodes: [${indices.map((index) => load(`nodes/${index}.js`)).join(',')}],
remotes: {${Object.entries(context.artifacts.remotes)
		.map(([id, file]) => `${JSON.stringify(id)}: ${load(file)}`)
		.join(',')}},
routes: [${selected
		.filter((route) => route.page || route.endpoint)
		.map(
			(route) =>
				`{ id: ${uneval(route.id)}, pattern: ${route.pattern}, params: ${uneval(route.params)}, page: ${uneval(page(route))}, endpoint: ${route.endpoint ? load(context.artifacts.endpoints[route.id]!) : 'null'} }`
		)
		.join(',')}],
prerendered_routes: new Set(${uneval(context.prerendered.paths)}), server_assets: ${uneval(files)},
matchers: async () => ${context.artifacts.matchers && selected.some((route) => route.params.some((param) => param.matcher)) ? `(await import(${JSON.stringify(location(context.artifacts.matchers))})).params` : '{}'}
}; })()`;
}

function universalCode(context: BuildContext, index: number, file: string): string {
	const options = context.tree.nodes[index]?.options ?? null;
	const inline =
		(context.config.router.type === 'hash' && options !== null && options.ssr === undefined) ||
		options?.ssr === false;
	return inline
		? `export const universal = ${uneval(options)};`
		: `export * as universal from ${JSON.stringify('../' + posix(file))};`;
}

export function writeNodes(context: BuildContext): void {
	for (const [index, node] of context.artifacts.nodes.entries()) {
		const file = path.join(context.config.outDir, 'output/server/nodes', `${index}.js`);
		const source = (name: string) => JSON.stringify('../' + posix(name));
		write(
			file,
			`export const index = ${index};\nexport const imports = ${uneval(node.imports)}, stylesheets = ${uneval(node.stylesheets)}, fonts = ${uneval(node.fonts)};\nexport const universal_id = ${uneval(context.tree.nodes[index]?.universal)}, server_id = ${uneval(context.tree.nodes[index]?.server)};\n${
				node.inlineStyles
					? `export const inline_styles = () => ({${Object.entries(node.inlineStyles)
							.map(([file, expression]) => `${JSON.stringify(file)}: (${expression})`)
							.join(',')}});`
					: ''
			}\nexport const component = () => import(${source(node.component)}).then(module => module.default);\n${node.universal ? universalCode(context, index, node.universal) : ''}\n${node.server ? `export * as server from ${source(node.server)};` : ''}\n`
		);
	}
}
