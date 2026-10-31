import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { ValidatedConfig } from '../types/builder.ts';
import type { PageNode, Route, RouteParam, RouteTree } from '../types/internal/routes.ts';
import { parameterType } from './app-types.ts';
import { importPath, relativeFile, writeChanged } from './files.ts';
import { createProxy, type TypeProxy } from './proxy.ts';

const helpers = [
	'type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;',
	'type Defined<T> = T extends null | undefined ? {} : T;',
	'type Merge<A, B> = Expand<Omit<A, keyof Defined<B>> & Defined<B>>;',
	'type OptionalUnion<U extends Record<string, any>, K extends PropertyKey = U extends U ? keyof U : never> = U extends unknown ? { [P in Exclude<K, keyof U>]?: never } & U : never;',
	'export type RequiredKeys<T> = { [K in keyof T]-?: {} extends { [P in K]: T[K] } ? never : K; }[keyof T];',
	'type Output<T> = Omit<App.PageData, RequiredKeys<T>> & Partial<Pick<App.PageData, keyof T & keyof App.PageData>> & Record<string, any>;',
	'type WithVoid<T> = {} extends T ? T | void : T;',
	'export type Snapshot<T = any> = Kit.Snapshot<T>;',
	'export type ErrorProps = { error: App.Error };'
].join('\n');

export function writeRouteTypes(
	config: ValidatedConfig,
	tree: RouteTree,
	root: string,
	name: string
): void {
	const routesDir = relativeFile(root, config.files.routes).replace(/\.\.\//g, '');
	const base = join(config.outDir, 'types');
	const output = (route: Route): string => join(base, routesDir, route.id.slice(1));
	const owners = new Map<number, Route>();
	for (const route of tree.routes)
		for (const index of [route.layout, route.leaf]) if (index !== null) owners.set(index, route);
	const files = new Set<string>();
	const proxies = new Map<string, TypeProxy | null>();
	const proxy = (file: string | undefined, route: Route): TypeProxy | null => {
		if (!file) return null;
		const key = file + ':' + route.id;
		if (!proxies.has(key)) proxies.set(key, createProxy(file, root, output(route)));
		const result = proxies.get(key)!;
		if (result?.file) files.add(result.file);
		return result;
	};
	const parentType = (node: PageNode, route: Route, kind: string): string => {
		const ancestors: string[] = [];
		let parent = node.parent;
		while (parent !== null) {
			const owner = owners.get(parent)!;
			const reference =
				owner === route
					? kind
					: `import(${JSON.stringify(importPath(output(route), join(output(owner), '$types.js')))}).${kind}`;
			ancestors.unshift(reference);
			parent = tree.nodes[parent]!.parent;
		}
		return ancestors.reduce((type, next) => `Merge<${type}, ${next}>`, '{}');
	};
	const dataType = (result: TypeProxy | null, fallback: string): string =>
		!result
			? 'unknown'
			: result.exports.has('load')
				? `Kit.LoadProperties<Awaited<ReturnType<typeof import(${JSON.stringify(result.module)}).load>>>`
				: fallback;
	for (const route of tree.routes) {
		if (route.leaf === null && route.layout === null && !route.endpoint) continue;
		const lines = [
			`import type * as Kit from ${JSON.stringify(name)};`,
			helpers,
			`type RouteId = ${JSON.stringify(route.id)};`,
			`type RouteParams = ${parameterType(route.params, output(route), root, tree.params, name)};`
		];
		if (route.params.length)
			lines.push('export type EntryGenerator = () => RouteParams[] | Promise<RouteParams[]>;');
		const nodeTypes = (index: number, page: boolean, allLoads: boolean): void => {
			const node = tree.nodes[index]!;
			const prefix = page ? 'Page' : 'Layout';
			const params = page ? 'RouteParams' : 'LayoutParams';
			const id = page ? 'RouteId' : 'LayoutRouteId';
			const server = proxy(node.server, route);
			const universal = proxy(node.universal, route);
			lines.push(
				`type ${prefix}ServerParentData = ${parentType(node, route, 'LayoutServerData')};`
			);
			lines.push(`type ${prefix}ParentData = ${parentType(node, route, 'LayoutData')};`);
			const serverData = node.server ? dataType(server, 'null') : 'null';
			lines.push(
				`export type ${prefix}ServerData = ${serverData === 'null' ? 'null' : `Expand<OptionalUnion<Defined<${serverData}>>>`};`
			);
			if (node.server) {
				const shape =
					node.universal || (!page && allLoads)
						? 'Partial<App.PageData> & Record<string, any> | void'
						: `WithVoid<Output<${prefix}ServerParentData>>`;
				lines.push(
					`export type ${prefix}ServerLoad<T extends ${shape} = ${shape}> = Kit.ServerLoad<${params}, ${prefix}ServerParentData, T, ${id}>;`
				);
				lines.push(`export type ${prefix}ServerLoadEvent = Parameters<${prefix}ServerLoad>[0];`);
			}
			let own = `${prefix}ServerData`;
			if (node.universal) {
				own = dataType(universal, `Merge<${prefix}ParentData, ${prefix}ServerData>`);
				const shape =
					!page && allLoads
						? 'Partial<App.PageData> & Record<string, any> | void'
						: `WithVoid<Output<${prefix}ParentData>>`;
				lines.push(
					`export type ${prefix}Load<T extends ${shape} = ${shape}> = Kit.Load<${params}, ${prefix}ServerData, ${prefix}ParentData, T, ${id}>;`
				);
				lines.push(`export type ${prefix}LoadEvent = Parameters<${prefix}Load>[0];`);
			}
			lines.push(
				`export type ${prefix}Data = Merge<${prefix}ParentData, OptionalUnion<Defined<${own}>>>;`
			);
			if (page && node.server) {
				if (server?.exports.has('actions')) {
					lines.push(
						`type ActionsExport = typeof import(${JSON.stringify(server.module)}).actions;`
					);
					lines.push('export type ActionData = Expand<Kit.AwaitedActions<ActionsExport>> | null;');
					lines.push('type Success<T> = T extends Kit.ActionFailure<any> | void ? never : T;');
					lines.push('type Failure<T> = T extends Kit.ActionFailure<infer U> ? U : never;');
					lines.push('type Results = Awaited<ReturnType<ActionsExport[keyof ActionsExport]>>;');
					lines.push(
						"export type SubmitFunction = import('$app/forms').SubmitFunction<Expand<Success<Results>>, Expand<Failure<Results>>>;"
					);
				} else lines.push('export type ActionData = unknown;');
				lines.push(
					'export type Action<T extends Record<string, any> | void = Record<string, any> | void> = Kit.Action<RouteParams, T, RouteId>;'
				);
				lines.push(
					'export type Actions<T extends Record<string, any> | void = Record<string, any> | void> = Kit.Actions<RouteParams, T, RouteId>;'
				);
			}
		};
		if (route.leaf !== null) {
			nodeTypes(route.leaf, true, true);
			lines.push(
				`export type PageProps = { params: RouteParams; data: PageData${tree.nodes[route.leaf]!.server ? '; form: ActionData' : ''} };`
			);
		}
		if (route.layout !== null) {
			const children = tree.routes.filter((child) => child.page?.layouts.includes(route.layout!));
			const params: RouteParam[] = [...route.params];
			for (const child of children)
				params.push(...child.params.map((param) => ({ ...param, optional: true })));
			lines.push(
				`type LayoutParams = ${parameterType(params, output(route), root, tree.params, name)};`
			);
			lines.push(
				`type LayoutRouteId = ${[...new Set(children.map((child) => JSON.stringify(child.id)))].concat(route.id === '/' ? ['null'] : []).join(' | ') || 'never'};`
			);
			const allLoads = children.every((child) => {
				const leaf = tree.nodes[child.leaf!]!;
				if (!leaf.server && !leaf.universal) return false;
				return (
					(!leaf.server || proxy(leaf.server, child)?.exports.has('load')) &&
					(!leaf.universal || proxy(leaf.universal, child)?.exports.has('load'))
				);
			});
			nodeTypes(route.layout, false, allLoads);
			lines.push(
				'export type LayoutProps = { params: LayoutParams; data: LayoutData; children: (...args: any[]) => any };'
			);
		}
		if (route.endpoint)
			lines.push('export type RequestHandler = Kit.RequestHandler<RouteParams, RouteId>;');
		if (
			route.endpoint ||
			(route.leaf !== null && tree.nodes[route.leaf]!.server) ||
			(route.layout !== null && tree.nodes[route.layout]!.server)
		)
			lines.push('export type RequestEvent = Kit.RequestEvent<RouteParams, RouteId>;');
		const destination = join(output(route), '$types.d.ts');
		writeChanged(destination, lines.join('\n') + '\n');
		files.add(destination);
	}
	const metadata = join(base, 'generated-files.json');
	if (existsSync(metadata)) {
		const previous = JSON.parse(readFileSync(metadata, 'utf8')) as string[];
		for (const file of previous)
			if (!files.has(file) && file.startsWith(base + '/')) rmSync(file, { force: true });
	}
	writeChanged(metadata, JSON.stringify([...files].sort()));
}
