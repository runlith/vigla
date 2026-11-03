import { join } from 'node:path';
import type { EnvVarConfig } from '../types/env.ts';
import type { ValidatedConfig } from '../types/builder.ts';
import type { PageOptions, RouteParam, RouteTree } from '../types/internal/routes.ts';
import { parseRoute, resolveRoute, routeSegments } from '../shared/routing/index.ts';
import { importPath, writeChanged } from './files.ts';

interface ParameterVariants {
	optional: boolean;
	matchers: Set<string> | null;
}

export function parameterType(
	params: readonly RouteParam[],
	directory: string,
	root: string,
	matcherFile: string | null,
	name: string
): string {
	const grouped = new Map<string, ParameterVariants>();
	for (const param of params) {
		const prior = grouped.get(param.name);
		if (!prior)
			grouped.set(param.name, {
				optional: param.optional,
				matchers: param.matcher ? new Set([param.matcher]) : null
			});
		else {
			prior.optional &&= param.optional;
			if (!param.matcher) prior.matchers = null;
			else prior.matchers?.add(param.matcher);
		}
	}
	return `{ ${[...grouped]
		.map(([key, param]) => {
			const type =
				param.matchers && matcherFile
					? [...param.matchers]
							.map(
								(matcher) =>
									`import(${JSON.stringify(name + '/params')}).MatcherParam<(typeof import(${JSON.stringify(importPath(directory, join(root, matcherFile)))}).params)[${JSON.stringify(matcher)}]>`
							)
							.join(' | ')
					: 'string';
			return `${JSON.stringify(key)}${param.optional ? '?' : ''}: ${type}${param.optional ? ' | undefined' : ''}`;
		})
		.join('; ')} }`;
}

function pathnameTypes(id: string): string[] {
	let paths = [''];
	for (const segment of routeSegments(id)) {
		const params = parseRoute('/' + segment).params;
		const values = Object.fromEntries(params.map((param) => [param.name, '${string}']));
		const path = resolveRoute('/' + segment, values).slice(1);
		const omittable =
			params.length === 1 && params[0]!.chained && (params[0]!.optional || params[0]!.rest);
		paths = paths.flatMap((prefix) => {
			const joined = prefix ? prefix + '/' + path : path;
			return omittable ? [joined, prefix] : [joined];
		});
	}
	return [...new Set(paths)];
}
function pathType(path: string): string {
	return path.includes('${string}')
		? '`' + path.replaceAll('`', '\\`').replace(/\$\{(?!string\})/g, '\\${') + '` & {}'
		: JSON.stringify(path);
}
function withSlash(path: string, options: PageOptions | null): string[] {
	if (path === '') return [''];
	if (options === null || options.trailingSlash === 'ignore') return [path, path + '/'];
	return [options.trailingSlash === 'always' ? path + '/' : path];
}

export function writeAppTypes(
	config: ValidatedConfig,
	tree: RouteTree,
	root: string,
	name: string
): void {
	const directory = join(root, 'node_modules/$app/types');
	const pages = tree.routes.filter((route) => route.page);
	const endpoints = tree.routes.filter((route) => route.endpoint);
	const routes = tree.routes.filter((route) => route.page || route.endpoint);
	const union = (ids: string[]): string =>
		ids.map((id) => JSON.stringify(id)).join(' | ') || 'never';
	const params = routes
		.filter((route) => route.params.length)
		.map(
			(route) =>
				`${JSON.stringify(route.id)}: ${parameterType(route.params, directory, root, tree.params, name)}`
		);
	const layouts = tree.routes
		.filter((route) => route.layout !== null)
		.map((route) => {
			const found = [...route.params];
			for (const child of tree.routes.filter((child) =>
				child.id.startsWith(route.id === '/' ? '/' : route.id + '/')
			)) {
				found.push(...child.params.map((param) => ({ ...param, optional: true })));
			}
			return `${JSON.stringify(route.id)}: ${parameterType(found, directory, root, tree.params, name)}`;
		});
	const paths = new Set<string>();
	for (const route of routes) {
		const options: Array<PageOptions | null> = [];
		if (route.page) options.push(tree.nodes[route.page.leaf]!.options);
		if (route.endpoint) options.push(route.endpoint.options);
		for (const path of pathnameTypes(route.id))
			for (const option of options)
				for (const variant of withSlash(path, option)) paths.add(pathType(variant));
	}
	const content = [
		`import ${JSON.stringify(name)};`,
		'declare module "$app/types" {',
		'\texport interface AppTypes {',
		`\t\tPageRouteId(): ${union(pages.map(({ id }) => id))};`,
		`\t\tEndpointRouteId(): ${union(endpoints.map(({ id }) => id))};`,
		`\t\tRouteId(): ${union(routes.map(({ id }) => id))};`,
		`\t\tRouteParams(): { ${params.join('; ')} };`,
		`\t\tLayoutParams(): { ${layouts.join('; ')} };`,
		`\t\tPath(): ${[...paths].join(' | ') || 'never'};`,
		`\t\tResolvedPathname(): \`\${${JSON.stringify(config.paths.base + '/')}}\${ReturnType<AppTypes["Path"]>}\`${config.paths.relative ? ' | `${"." | ".." | `../${string}`}/${ReturnType<AppTypes["Path"]>}`' : ''};`,
		`\t\tAssetPath(): ${union(tree.assets.map(({ file }) => file))};`,
		'\t}',
		'}'
	].join('\n');
	writeChanged(join(directory, 'non-ambient.d.ts'), content);
	writeChanged(
		join(directory, 'index.d.ts'),
		`import ${JSON.stringify(name)};\nimport './env.js';\nimport './non-ambient.js';\n`
	);
}

export function writeEnvironment(
	root: string,
	name: string,
	entry: string | null,
	variables: Record<string, EnvVarConfig<any>> | null
): void {
	const directory = join(root, 'node_modules/$app/types');
	const source = entry ? importPath(directory, entry) : '';
	const content = ['private', 'public']
		.map((visibility) => {
			const declarations = Object.entries(variables ?? {})
				.filter(([, config]) => !!config.public === (visibility === 'public'))
				.map(([key, config]) => {
					const type =
						config.schema && entry
							? `Value<typeof import(${JSON.stringify(source)}).variables[${JSON.stringify(key)}]>`
							: 'string';
					return `\texport const ${key}: ${type};`;
				});
			return [
				`declare module '$app/env/${visibility}' {`,
				`\ttype Value<T> = T extends import(${JSON.stringify(name + '/env')}).EnvVarConfig<infer Output> ? Output : never;`,
				...declarations,
				'}'
			].join('\n');
		})
		.join('\n');
	writeChanged(join(directory, 'env.d.ts'), content);
}
