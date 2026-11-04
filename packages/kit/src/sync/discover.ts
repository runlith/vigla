import { existsSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { lookup } from '../shared/mime.ts';
import type { ValidatedConfig } from '../types/builder.ts';
import type { PageNode, Route, RouteTree } from '../types/internal/routes.ts';
import { parseRoute, sortRoutes } from '../shared/routing/index.ts';
import type { Diagnostics } from '../shared/diagnostics.ts';
import { SyncWarnings } from './warnings.ts';
import { filesUnder, relativeFile, resolveEntry } from './files.ts';
import { applyOptions, readOptions } from './options.ts';
import { validateConflicts, validateRoute } from './route-paths.ts';
import { SyncErrors } from './errors.ts';

interface PendingRoute {
	route: Route;
	layout: PageNode | null;
	error: PageNode | null;
	leaf: PageNode | null;
}
const componentName = /^\+(page|layout|error)(?:@(.*))?$/;
const moduleName = /^\+(server|page|layout)(@[^.]+|@)?(\.server)?$/;

function node(depth: number): PageNode {
	return { depth, parent: null, options: null };
}

export function discover(config: ValidatedConfig, root: string, d: Diagnostics): RouteTree {
	const e: SyncErrors = new SyncErrors(d);
	const w: SyncWarnings = new SyncWarnings(d);
	const pending: PendingRoute[] = [];
	const resets = new Map<PageNode, string>();
	const walk = (
		directory: string,
		id: string,
		depth: number,
		parent: string | null,
		ancestors: Set<string>
	): void => {
		validateRoute(id, e);
		const route: Route = {
			id,
			parent,
			segment: id === '/' ? '' : id.slice(id.lastIndexOf('/') + 1),
			...parseRoute(id),
			layout: null,
			error: null,
			leaf: null,
			page: null,
			endpoint: null
		};
		const branch: PendingRoute = { route, layout: null, error: null, leaf: null };
		pending.push(branch);
		if (!existsSync(directory)) {
			route.pattern = /^$/;
			return;
		}
		const real = realpathSync(directory);
		if (ancestors.has(real)) return;
		const visited = new Set(ancestors).add(real);
		const entries = readdirSync(directory)
			.filter((name) => !name.startsWith('_') && (!name.startsWith('.') || name === '.well-known'))
			.sort();
		const directories: string[] = [];
		for (const name of entries) {
			const file = join(directory, name);
			if (statSync(file).isDirectory()) {
				directories.push(name);
				continue;
			}
			const extension = [...config.extensions, ...config.moduleExtensions].find((ext) =>
				name.endsWith(ext)
			);
			if (!extension) continue;
			const component = config.extensions.includes(extension);
			const stem = name.slice(0, -extension.length);
			if (!name.startsWith('+')) {
				if ((component ? componentName : moduleName).test('+' + stem))
					w.route_file_prefix_missing({ file, corrected: '+' + name });
				continue;
			}
			if (/\.(?:test|spec|stories)\./.test(name)) continue;
			if (/\.d\.ts$/.test(name)) {
				let declaration = name.slice(0, -5);
				const suffix = [...config.extensions, ...config.moduleExtensions].find((ext) =>
					declaration.endsWith(ext)
				);
				if (suffix) declaration = declaration.slice(0, -suffix.length);
				if (componentName.test(declaration) || moduleName.test(declaration)) continue;
			}
			const match = (component ? componentName : moduleName).exec(stem);
			const source = relativeFile(root, file);
			if (!match || (component && match[1] === 'error' && match[2] !== undefined))
				e.route_file_reserved({ file: source });
			const role = match[1]!;
			if (!component && match[2] !== undefined)
				e.route_named_layout_in_module({
					file: source,
					name,
					layout: match[2],
					extension: config.extensions[0] ?? ''
				});
			const kind = component ? 'component' : role === 'server' || match[3] ? 'server' : 'universal';
			if (config.router.type === 'hash' && kind === 'server')
				e.route_server_file_hash_router({ file: source });
			const duplicate = (type: string, existing: string): never =>
				e.route_duplicate_files({
					type,
					directory: relativeFile(root, directory),
					existing: basename(existing),
					file: name
				});
			if (role === 'server') {
				if (route.endpoint) duplicate('endpoint', route.endpoint.file);
				route.endpoint = { file: source, options: null };
				continue;
			}
			const slot = role === 'page' ? 'leaf' : (role as 'layout' | 'error');
			const target = (branch[slot] ??= node(depth));
			if (target[kind])
				duplicate(`${role} ${kind === 'component' ? 'component' : kind + ' module'}`, target[kind]);
			target[kind] = source;
			if (component && match[2] !== undefined) resets.set(target, match[2]);
		}
		for (const name of directories)
			walk(
				join(directory, name),
				id === '/' ? '/' + name : id + '/' + name,
				depth + 1,
				id,
				visited
			);
	};
	walk(config.files.routes, '/', 0, null, new Set());
	if (
		existsSync(config.files.routes) &&
		pending.length === 1 &&
		!pending[0]!.layout &&
		!pending[0]!.error &&
		!pending[0]!.leaf &&
		!pending[0]!.route.endpoint
	)
		e.routes_not_found();
	pending[0]!.layout ??= node(0);
	pending[0]!.error ??= node(0);
	const nodes: PageNode[] = [];
	const add = (entry: PendingRoute, key: 'layout' | 'error' | 'leaf'): void => {
		if (entry[key]) {
			entry.route[key] = nodes.length;
			nodes.push(entry[key]);
		}
	};
	for (const entry of pending) {
		add(entry, 'layout');
		add(entry, 'error');
	}
	for (const entry of pending) add(entry, 'leaf');
	const byId = new Map(pending.map((entry) => [entry.route.id, entry]));
	for (const entry of pending) {
		const route = entry.route;
		if (route.leaf === null) continue;
		const page = (route.page = {
			layouts: [] as Array<number | undefined>,
			errors: [] as Array<number | undefined>,
			leaf: route.leaf
		});
		let current: PendingRoute | undefined = entry;
		let child = entry.leaf!;
		let reset = resets.get(child);
		while (current) {
			if (reset === undefined || current.route.segment === reset) {
				if (current.layout || current.error) {
					page.layouts.unshift(current.route.layout ?? undefined);
					page.errors.unshift(current.route.error ?? undefined);
				}
				if (current.layout) {
					child.parent = current.route.layout;
					child = current.layout;
					reset = resets.get(child);
				} else reset = undefined;
			}
			current = current.route.parent === null ? undefined : byId.get(current.route.parent);
		}
		if (reset !== undefined)
			e.route_layout_segment_missing({
				file: child.component ?? child.universal ?? child.server!,
				segment: reset
			});
	}
	for (const entry of pending) {
		if (entry.error) {
			let parent: PendingRoute | undefined = entry;
			while (parent && parent.route.layout === null)
				parent = parent.route.parent === null ? undefined : byId.get(parent.route.parent);
			entry.error.parent = parent?.route.layout ?? null;
		}
		if (entry.layout && entry.layout.parent === null && entry !== pending[0]) {
			let parent = entry.route.parent === null ? undefined : byId.get(entry.route.parent);
			while (parent && parent.route.layout === null)
				parent = parent.route.parent === null ? undefined : byId.get(parent.route.parent);
			entry.layout.parent = parent?.route.layout ?? null;
		}
	}
	const routes = pending
		.map(({ route }) => route)
		.filter(
			(route) =>
				route.layout !== null || route.error !== null || route.leaf !== null || route.endpoint
		);
	validateConflicts(routes, e);
	applyOptions(nodes, root);
	for (const route of routes) {
		if (!route.endpoint) continue;
		route.endpoint.options = readOptions(route.endpoint.file, root);
		if (
			route.page &&
			(nodes[route.page.leaf]!.options?.prerender || route.endpoint.options?.prerender)
		)
			e.route_prerender_page_and_endpoint({
				id: route.id,
				file: basename(route.endpoint.file),
				extension: config.extensions[0] ?? ''
			});
	}
	const hook = (file: string): string | null => {
		const entry = resolveEntry(file, config.moduleExtensions);
		if (entry) return relativeFile(root, entry);
		const name = basename(file);
		if (name.startsWith('hooks')) {
			for (const [typo, description] of [
				['+' + name, 'Unexpected + prefix'],
				[name.replace(/^hooks/, 'hook'), 'Missing s suffix']
			] as const) {
				const candidate = resolveEntry(join(dirname(file), typo), config.moduleExtensions);
				if (candidate)
					w.file_name_misspelled({
						file: candidate,
						corrected: basename(candidate).replace(typo, name),
						description
					});
			}
		}
		return null;
	};
	return {
		assets: filesUnder(config.files.assets).map((file) => ({
			file: relativeFile(config.files.assets, file),
			type: lookup(file) ?? null
		})),
		hooks: {
			client: hook(config.files.hooks.client),
			server: hook(config.files.hooks.server),
			universal: hook(config.files.hooks.universal)
		},
		params: hook(config.files.params),
		nodes,
		routes: sortRoutes(routes)
	};
}
