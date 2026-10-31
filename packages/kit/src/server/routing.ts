import { uneval } from 'devalue';
import type { ClientRoute } from '../types/internal/server.ts';
import type { Server } from './index.ts';
import { findRoute } from '../shared/routing/index.ts';
import { clientPath, documentPaths } from './paths.ts';

export function routeObject(server: Server, route: ClientRoute, url: URL): string {
	const client = server.manifest.client!;
	const paths = documentPaths(url.pathname, server.options.paths);
	const ids = new Set([
		...route.errors,
		...route.layouts.map((layout) => layout?.[1]),
		route.leaf[1]
	]);
	const nodes = [...ids]
		.filter((id): id is number => typeof id === 'number')
		.map(
			(id) =>
				`${JSON.stringify(id)}:()=>${client.nodes?.[id] ? `import(${JSON.stringify(clientPath(client.nodes[id]!, paths))})` : 'Promise.resolve({})'}`
		);
	return `{id:${JSON.stringify(route.id)},errors:${JSON.stringify(route.errors)},layouts:${JSON.stringify(route.layouts)},leaf:${JSON.stringify(route.leaf)},nodes:{${nodes.join(',')}}}`;
}

export async function resolutionResponse(
	server: Server,
	path: string,
	url: URL
): Promise<Response> {
	const client = server.manifest.client;
	if (!client?.routes)
		return new Response('Server-side route resolution disabled', { status: 400 });
	const idPrefix = `/${server.manifest.app_dir}/routes`;
	const byId = path === idPrefix || path.startsWith(`${idPrefix}/`);
	const routeId = path.slice(idPrefix.length) || '/';
	try {
		const matched = byId ? null : findRoute(path, client.routes, await server.manifest.matchers());
		const route = byId ? client.routes.find((route) => route.id === routeId) : matched?.route;
		let body = '';
		if (route) {
			const paths = documentPaths(url.pathname, server.options.paths);
			const css = new Set(
				[...route.errors, ...route.layouts.map((layout) => layout?.[1]), route.leaf[1]].flatMap(
					(id) => (id == null ? [] : (client.css?.[id] ?? []))
				)
			);
			if (css.size)
				body += `import(${JSON.stringify(clientPath(client.start, paths))}).then(x=>x.load_css(${JSON.stringify([...css].map((file) => clientPath(file, paths)))}));\n`;
			body += `export const route=${routeObject(server, route, url)};`;
			if (!byId) body += `\nexport const params=${uneval(matched?.params ?? {})};`;
		} else if (byId && server.manifest.routes.some((route) => route.id === routeId && !route.page))
			body = 'export const endpoint_only=true;';
		return new Response(body, {
			headers: { 'content-type': 'application/javascript; charset=utf-8' }
		});
	} catch {
		return new Response('Error resolving route', { status: 500 });
	}
}
