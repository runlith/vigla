import path from 'node:path';
import type { PageNode } from '../types/internal/routes.ts';
import type { Project } from './project.ts';
import { ids, nodeId } from './ids.ts';
import { moduleUrl, posix } from './paths.ts';

export function clientNode(node: PageNode, index: number, root: string): string {
	const lines: string[] = [];
	if (node.universal)
		lines.push(
			`export * as universal from ${JSON.stringify(posix(path.resolve(root, node.universal)))};`
		);
	const component = node.component
		? posix(path.resolve(root, node.component))
		: index === 1
			? ids.error
			: ids.layout;
	lines.push(`export { default as component } from ${JSON.stringify(component)};`);
	return lines.join('\n');
}

export function clientApp(project: Project): string {
	const { config, tree, root, format } = project;
	const hasServerLoad = (index: number) =>
		project.build?.analysis.nodes[index]?.hasServerLoad ?? !!tree.nodes[index]?.server;
	const lines: string[] = [];
	if (project.vite.command === 'build' && config.output.bundleStrategy !== 'split')
		lines.push(`import ${JSON.stringify(ids.bootstrap)};`);
	lines.push(`export { default as root } from ${JSON.stringify(ids.root)};`);
	for (const side of ['client', 'universal'] as const) {
		const file = tree.hooks[side];
		lines.push(
			file
				? `import * as ${side} from ${JSON.stringify(posix(path.resolve(root, file)))};`
				: `const ${side} = {};`
		);
	}
	const hasMatchers = tree.routes.some((route) => route.params.some((param) => param.matcher));
	if (tree.params && hasMatchers && config.router.resolution === 'client') {
		lines.push(
			`export { params as matchers } from ${JSON.stringify(posix(path.resolve(root, tree.params)))};`
		);
	} else {
		lines.push('export const matchers = {};');
	}
	const dictionary: string[] = [];
	const sparse = (indices: Array<number | undefined>) => {
		const values = indices.slice(1);
		while (values.at(-1) === undefined && values.length) values.pop();
		return `[${values.map((index) => index ?? '').join(',')}]`;
	};
	const serverLoads = new Set<number>();
	for (const route of tree.routes) {
		if (!route.page) continue;
		const { leaf, layouts, errors } = route.page;
		for (const index of layouts) {
			if (index !== undefined && hasServerLoad(index)) serverLoads.add(index);
		}
		dictionary.push(
			`${JSON.stringify(route.id)}: [${hasServerLoad(leaf) ? ~leaf : leaf},${sparse(layouts)},${sparse(errors)}]`
		);
	}
	const clientRouting = config.router.resolution === 'client';
	const loaders = tree.nodes
		.slice(0, clientRouting ? tree.nodes.length : 2)
		.map(
			(_, index) =>
				`() => import(${JSON.stringify(project.vite.command === 'serve' ? moduleUrl(nodeId(project, index), root) : nodeId(project, index))})`
		);
	lines.push(
		`export const nodes = [${loaders.join(',')}];`,
		`export const dictionary = {${clientRouting ? dictionary.join(',') : ''}};`,
		`export const serverLoads = ${JSON.stringify([...serverLoads].filter((index) => clientRouting || index === 0))};`,
		`export const hooks = {init: client.init, handleError: client.handleError, reroute: universal.reroute, transport: universal.transport ?? {}};`,
		'export const encoders = Object.fromEntries(Object.entries(hooks.transport).map(([name, value]) => [name, value.encode]));',
		'export const decoders = Object.fromEntries(Object.entries(hooks.transport).map(([name, value]) => [name, value.decode]));',
		'export const decode = (name, value) => decoders[name](value);',
		`export const global = ${JSON.stringify(project.global)};`,
		`export const clientRouting = ${clientRouting};`,
		`export const versionChecks = ${config.output.bundleStrategy !== 'inline'};`,
		`export const format = ${JSON.stringify(format) ?? 'undefined'};`,
		`export const errorTemplate = () => import(${JSON.stringify(ids.errorTemplate)}).then(module => module.default);`
	);
	return lines.join('\n');
}
