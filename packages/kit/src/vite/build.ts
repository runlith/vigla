import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import type { Manifest, Plugin, ViteBuilder } from 'vite';
import {
	analyseBuild,
	copy,
	createBuilder,
	createLogger,
	manifestSource,
	prerenderBuild,
	walk,
	write,
	writeNodes,
	type BuildContext,
	type BuiltNode
} from '../build/index.ts';
import { resolveConfig } from '../config/index.ts';
import type { ValidatedConfig } from '../types/builder.ts';
import type { ManifestRoute } from '../types/paths.ts';
import type { ClientBuild, Style } from '../types/internal/server.ts';
import { dependencies, entry } from './dependencies.ts';
import { styleExpression } from './styles.ts';
import { pruneRemotes } from './remote-build.ts';
import { ids, nodeId } from './ids.ts';
import { resolveEntry } from '../sync/index.ts';
import { packageDirectory, posix } from './paths.ts';
import type { Project } from './project.ts';
import * as e from './messages.ts';

function json(file: string): Manifest {
	return JSON.parse(readFileSync(file, 'utf8'));
}
const clientModules = ['forms', 'navigation', 'state'].map((name) => ({
	name: `$app/${name}`,
	directory: posix(path.join(packageDirectory, 'src/entries/app', name)) + '/'
}));
function refuseClientModules(output: Awaited<ReturnType<ViteBuilder['build']>>): void {
	const used = new Set<string>();
	for (const result of Array.isArray(output) ? output : 'output' in output ? [output] : [])
		for (const chunk of result.output)
			if (chunk.type === 'chunk')
				for (const id of chunk.moduleIds)
					for (const module of clientModules)
						if (posix(id).startsWith(module.directory)) used.add(module.name);
	if (used.size)
		e.service_worker_invalid_import({
			modules: clientModules
				.filter((module) => used.has(module.name))
				.map((module) => module.name)
				.join(', ')
		});
}
function immutableFiles(
	manifest: Manifest,
	appDir: string,
	inlined: Set<string>
): { path: string }[] {
	const files = new Set<string>();
	for (const chunk of Object.values(manifest))
		for (const file of [chunk.file, ...(chunk.css ?? []), ...(chunk.assets ?? [])])
			if (file.startsWith(appDir + '/immutable/') && !inlined.has(file)) files.add(file);
	return Array.from(files, (path) => ({ path }));
}
interface ClientOutput {
	sources: Map<string, string>;
	inlineScript: string;
	inlined: Set<string>;
}
function inlineNodeStyles(
	node: BuiltNode,
	client: string,
	project: Project,
	clientFiles: Set<string>
): void {
	const styles = node.stylesheets.filter(
		(file) =>
			readFileSync(path.join(client, file)).byteLength <= project.config.inlineStyleThreshold
	);
	if (!styles.length) return;
	const staticFiles = new Set(project.tree.assets.map((asset) => asset.file));
	node.inlineStyles = Object.fromEntries(
		styles.map((file) => [
			file,
			styleExpression(readFileSync(path.join(client, file), 'utf8'), file, clientFiles, staticFiles)
		])
	);
}
function skipClient(
	project: Project,
	context: BuildContext,
	serverManifest: Manifest,
	component: (index: number) => string
): ClientOutput {
	const output = path.join(project.config.outDir, 'output');
	const client = path.join(output, 'client');
	const immutable = path.join(project.config.appDir, 'immutable');
	copy(path.join(output, 'server', immutable), path.join(client, immutable));
	copy(project.config.files.assets, client);
	if (project.config.output.bundleStrategy === 'split') {
		const clientFiles = new Set(walk(client));
		for (const [index, node] of context.artifacts.nodes.entries()) {
			const source = project.tree.nodes[index]!;
			const files = [
				component(index),
				...(source.universal ? [path.resolve(project.root, source.universal)] : [])
			];
			for (const file of files) {
				const deps = dependencies(serverManifest, file, project.root, true);
				node.stylesheets.push(...deps.stylesheets);
				node.fonts.push(...deps.fonts);
			}
			inlineNodeStyles(node, client, project, clientFiles);
		}
	}
	return { sources: new Map(), inlineScript: '', inlined: new Set() };
}
async function buildClient(
	builder: ViteBuilder,
	project: Project,
	context: BuildContext,
	serverManifest: Manifest,
	component: (index: number) => string
): Promise<ClientOutput> {
	const output = path.join(project.config.outDir, 'output');
	const server = path.join(output, 'server');
	const client = path.join(output, 'client');
	const start = path.join(packageDirectory, 'src/entries/internal/client.ts');
	const clientInputs: Record<string, string> = {
		'entry/start': start,
		'entry/app': ids.client
	};
	project.tree.nodes.forEach((_, index) => {
		clientInputs[`nodes/${index}`] = nodeId(project, index);
	});
	const split = project.config.output.bundleStrategy === 'split';
	builder.environments.client!.config.build.rolldownOptions.input = split
		? clientInputs
		: ids.bundle;
	await builder.build(builder.environments.client!);
	const serverStyles = new Set(
		Object.values(serverManifest)
			.flatMap((chunk) => chunk.css ?? [])
			.map((file) => path.basename(file))
	);
	copy(
		path.join(server, project.config.appDir, 'immutable'),
		path.join(client, project.config.appDir, 'immutable'),
		{ filter: (name) => !serverStyles.has(name) }
	);
	const clientManifest = json(path.join(client, '.vite/manifest.json'));
	const initial = dependencies(clientManifest, split ? start : ids.bundle, project.root, false);
	const app = split ? dependencies(clientManifest, ids.client, project.root, false) : undefined;
	const built: ClientBuild = {
		start: initial.file,
		app: app?.file,
		imports: [...new Set([...initial.imports, ...(app?.imports ?? [])])],
		stylesheets: [...new Set([...initial.stylesheets, ...(app?.stylesheets ?? [])])],
		fonts: [...initial.fonts, ...(app?.fonts ?? [])],
		uses_env_dynamic_public: Object.values(project.environment.variables).some(
			(variable) => variable.public && !variable.static
		)
	};
	context.artifacts.client = built;
	if (project.config.router.resolution === 'server') {
		built.nodes = project.tree.nodes.map(
			(_, index) => dependencies(clientManifest, nodeId(project, index), project.root, true).file
		);
		built.routes = project.tree.routes
			.filter((route) => route.page)
			.map((route) => ({
				id: route.id,
				pattern: route.pattern,
				params: route.params,
				errors: route.page!.errors,
				layouts: route.page!.layouts.map((index) =>
					index === undefined ? undefined : [context.analysis.nodes[index]!.hasServerLoad, index]
				),
				leaf: [context.analysis.nodes[route.page!.leaf]!.hasServerLoad, route.page!.leaf]
			}));
	}
	const clientFiles = new Set(walk(client));
	const staticFiles = new Set(project.tree.assets.map((asset) => asset.file));
	for (const [index, node] of context.artifacts.nodes.entries()) {
		const deps = split
			? dependencies(clientManifest, nodeId(project, index), project.root, true)
			: initial;
		node.imports = deps.imports;
		node.stylesheets = deps.stylesheets;
		node.fonts = deps.fonts;
		if (split) {
			const source = project.tree.nodes[index]!;
			const rendering = dependencies(serverManifest, component(index), project.root, true);
			const rendered = new Set(rendering.bySource.keys());
			if (source.universal) {
				const universal = dependencies(
					serverManifest,
					path.resolve(project.root, source.universal),
					project.root,
					true
				);
				for (const id of universal.bySource.keys()) rendered.add(id);
			}
			const stylesheets = new Set<string>();
			const fonts = new Set<string>();
			for (const [id, resources] of deps.bySource)
				if (rendered.has(id === deps.source ? rendering.source : id)) {
					for (const file of resources.stylesheets) stylesheets.add(file);
					for (const file of resources.fonts) fonts.add(file);
				}
			node.stylesheets = [...stylesheets];
			node.fonts = deps.fonts.filter((font) => fonts.has(font.file));
		}
		inlineNodeStyles(node, client, project, clientFiles);
	}
	const clientSources = sources(client);
	const inline = project.config.output.bundleStrategy === 'inline';
	const inlineStyles = inline
		? Object.values(clientManifest)
				.filter((file) => file.file.endsWith('.css'))
				.map((file) => file.file)
		: [];
	const inlined = new Set(inline ? [initial.file, `${initial.file}.map`, ...inlineStyles] : []);
	const inlineScript = inline
		? clientSources.get(initial.file)!.replace(/\n\/\/# sourceMappingURL=\S+\s*$/, '\n') +
			`;globalThis.${project.global}.app=__sveltekit_bundle;`
		: '';
	context.manifest.immutable.push(
		...immutableFiles(clientManifest, project.config.appDir, inlined)
	);
	replaceManifest(client, clientSources, context);
	if (inline) {
		const styles = inlineStyles.map(
			(file) =>
				`(${styleExpression(readFileSync(path.join(client, file), 'utf8'), file, clientFiles, staticFiles)})(assets,base)`
		);
		if (styles.length) {
			const source = `(assets,base) => [${styles.join(',')}].join('\\n')`;
			context.artifacts.inlineStyle = {
				source,
				render: new Function('return ' + source)() as Style
			};
		}
		built.inline = {
			script: manifestCode(inlineScript, context),
			style: context.artifacts.inlineStyle?.render
		};
		built.imports = [];
		built.stylesheets = [];
		for (const node of context.artifacts.nodes) {
			node.imports = [];
			node.stylesheets = [];
			node.inlineStyles = undefined;
		}
	}
	return { sources: clientSources, inlineScript, inlined };
}
function sources(directory: string): Map<string, string> {
	return new Map(
		walk(directory)
			.filter((file) => file.endsWith('.js'))
			.map((file) => [file, readFileSync(path.join(directory, file), 'utf8')])
	);
}
function replaceManifest(
	directory: string,
	originals: Map<string, string>,
	context: BuildContext
): void {
	for (const [file, code] of originals)
		write(path.join(directory, file), manifestCode(code, context));
}
function manifestCode(code: string, context: BuildContext): string {
	return code
		.replaceAll('__SVELTEKIT_MANIFEST_IMMUTABLE__', JSON.stringify(context.manifest.immutable))
		.replaceAll('__SVELTEKIT_MANIFEST_PRERENDERED__', JSON.stringify(context.manifest.prerendered));
}
function fresh(project: Project): BuildContext {
	return {
		config: project.config,
		root: project.root,
		mode: project.vite.mode,
		tree: project.tree,
		artifacts: {
			client: null,
			nodes: [],
			endpoints: {},
			matchers: null,
			remotes: {},
			chunks: {},
			serviceWorker: null
		},
		analysis: { nodes: [], routes: new Map(), remotes: new Map(), environment: {} },
		prerendered: { pages: new Map(), assets: new Map(), redirects: new Map(), paths: [] },
		prerenderMap: new Map(),
		manifest: {
			immutable: [],
			prerendered: [],
			assets: project.tree.assets.map((asset) => ({ path: asset.file })),
			routes: project.tree.routes
				.filter((route) => route.page || route.endpoint)
				.map((route): ManifestRoute =>
					route.page
						? route.endpoint
							? { id: route.id, page: true, endpoint: true }
							: { id: route.id, page: true, endpoint: false }
						: { id: route.id, page: false, endpoint: true }
				)
		},
		environment: project.environment.values,
		log: createLogger(project.vite.logLevel !== 'silent')
	};
}

export function buildPlugin(
	validated: ValidatedConfig,
	getProject: () => Promise<Project>
): Plugin {
	return {
		name: 'kit:build',
		apply: 'build',
		config(user) {
			const root = path.resolve(user.root ?? process.cwd());
			const config = resolveConfig(validated, root);
			const output = path.join(config.outDir, 'output');
			const immutable = config.appDir + '/immutable';
			const inline = config.output.bundleStrategy === 'inline';
			const split = config.output.bundleStrategy === 'split';
			const serviceWorker = resolveEntry(config.files.serviceWorker, config.moduleExtensions);
			if (serviceWorker && config.paths.assets)
				throw new Error('Cannot use service worker alongside config.paths.assets');
			return {
				base: config.paths.relative || config.paths.assets ? './' : (config.paths.base || '') + '/',
				builder: { sharedConfigBuild: true, sharedPlugins: true },
				build: { emptyOutDir: false, manifest: true, cssCodeSplit: !inline },
				worker: {
					rolldownOptions: {
						output: {
							entryFileNames: `${immutable}/workers/[name]-[hash].js`,
							chunkFileNames: `${immutable}/workers/chunks/[hash].js`,
							assetFileNames: `${immutable}/workers/assets/[name]-[hash][extname]`
						}
					}
				},
				experimental: {
					renderBuiltUrl(filename, { ssr, hostType }) {
						const relative = config.paths.relative || !!config.paths.assets;
						if (hostType === 'js')
							return ssr
								? (config.paths.assets || config.paths.base) + '/' + filename
								: { relative };
						if (relative) return './' + path.posix.relative(immutable + '/assets', filename);
					}
				},
				environments: {
					ssr: {
						build: {
							outDir: path.join(output, 'server'),
							target: 'node22',
							copyPublicDir: false,
							emitAssets: true,
							rolldownOptions: {
								input: { index: ids.server, internal: ids.options, env: ids.env },
								preserveEntrySignatures: 'strict',
								output: {
									format: 'es',
									entryFileNames: '[name].js',
									chunkFileNames: 'chunks/[name].js',
									assetFileNames: `${immutable}/assets/[name].[hash][extname]`
								}
							}
						}
					},
					client: {
						build: {
							outDir: path.join(output, 'client'),
							copyPublicDir: true,
							rolldownOptions: {
								input: inline || !split ? ids.bundle : ids.client,
								preserveEntrySignatures: 'strict',
								output: {
									format: inline ? 'iife' : 'es',
									name: '__sveltekit_bundle',
									entryFileNames: `${immutable}/[name].[hash].js`,
									chunkFileNames: (chunk) =>
										chunk.name === 'sveltekit-manifest'
											? `${config.appDir}/manifest.js`
											: `${immutable}/chunks/[hash].js`,
									assetFileNames: `${immutable}/assets/[name].[hash][extname]`,
									codeSplitting: split
										? { groups: [{ name: 'sveltekit-manifest', test: ids.appManifest }] }
										: false
								}
							}
						}
					},
					...(serviceWorker
						? {
								serviceWorker: {
									consumer: 'client' as const,
									build: {
										outDir: path.join(output, 'client'),
										emptyOutDir: false,
										copyPublicDir: false,
										manifest: '.vite/service-worker-manifest.json',
										modulePreload: false,
										rolldownOptions: {
											input: serviceWorker,
											external: [`${config.paths.base}/${config.appDir}/env.js`],
											output: {
												format: 'es' as const,
												entryFileNames: 'service-worker.js',
												assetFileNames: `${immutable}/assets/[name].[hash][extname]`,
												codeSplitting: false
											}
										}
									}
								}
							}
						: {})
				}
			};
		},
		async generateBundle() {
			if (this.environment.name === 'client') {
				const project = await getProject();
				this.emitFile({
					type: 'asset',
					fileName: project.config.appDir + '/version.json',
					source: JSON.stringify({ version: project.config.version.name })
				});
			}
		},
		async buildApp(builder) {
			const project = await getProject();
			const context = fresh(project);
			project.build = context;
			const output = path.join(context.config.outDir, 'output');
			const server = path.join(output, 'server');
			const client = path.join(output, 'client');
			rmSync(output, { recursive: true, force: true });
			mkdirSync(output, { recursive: true });
			write(path.join(output, 'package.json'), '{"type":"module"}');
			const inputs: Record<string, string> = {
				index: ids.server,
				internal: ids.options,
				env: ids.env
			};
			const component = (index: number): string => {
				const file = project.tree.nodes[index]!.component;
				return file ? path.resolve(project.root, file) : index === 1 ? ids.error : ids.layout;
			};
			const named = (kind: string, file: string): string => {
				const relative = decodeURIComponent(
					posix(path.relative(project.config.files.routes, file))
				);
				return relative.startsWith('..')
					? `entries/fallbacks/${path.basename(file)}`
					: `entries/${kind}/${relative.replace(/\.js$/, '')}`;
			};
			project.tree.nodes.forEach((node, index) => {
				inputs[
					node.component
						? named('pages', component(index))
						: `entries/fallbacks/${index === 1 ? 'error' : 'layout'}.svelte`
				] = component(index);
				for (const file of [node.universal, node.server])
					if (file) {
						const resolved = path.resolve(project.root, file);
						inputs[named('pages', resolved)] = resolved;
					}
			});
			for (const route of project.tree.routes)
				if (route.endpoint) {
					const file = path.resolve(project.root, route.endpoint.file);
					inputs[named('endpoints', file)] = file;
				}
			if (project.tree.params) {
				inputs['entries/params'] = path.resolve(project.root, project.tree.params);
				context.artifacts.matchers = 'entries/params.js';
			}
			const instrumentation = resolveEntry(
				path.join(project.config.files.src, 'instrumentation.server'),
				project.config.moduleExtensions
			);
			if (instrumentation) inputs['instrumentation.server'] = instrumentation;
			builder.environments.ssr!.config.build.rolldownOptions.input = inputs;
			await builder.build(builder.environments.ssr!);
			const serverManifest = json(path.join(server, '.vite/manifest.json'));
			const built = (file: string): string => entry(serverManifest, file, project.root).file;
			context.artifacts.nodes = project.tree.nodes.map((node, index) => ({
				component: built(component(index)),
				universal: node.universal && built(path.resolve(project.root, node.universal)),
				server: node.server && built(path.resolve(project.root, node.server)),
				imports: [],
				stylesheets: [],
				fonts: []
			}));
			for (const route of project.tree.routes)
				if (route.endpoint)
					context.artifacts.endpoints[route.id] = entry(
						serverManifest,
						path.resolve(project.root, route.endpoint.file),
						project.root
					).file;
			for (const chunk of Object.values(serverManifest))
				context.artifacts.chunks[chunk.file] = {
					file: chunk.file,
					imports: [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])].map(
						(id) => serverManifest[id]!.file
					),
					assets: chunk.assets ?? []
				};
			for (const [id, entry] of project.remote.entries)
				if (entry.chunk) context.artifacts.remotes[id] = entry.chunk;
			const serverSources = sources(server);
			writeNodes(context);
			replaceManifest(server, serverSources, context);
			const full = () =>
				write(
					path.join(server, 'manifest-full.js'),
					'export const manifest = ' +
						manifestSource({
							context,
							routes: project.tree.routes.filter((route) => route.page || route.endpoint),
							relativePath: '.'
						}) +
						';'
				);
			full();
			context.analysis = await analyseBuild(context);
			const {
				sources: clientSources,
				inlineScript,
				inlined
			} = project.tree.nodes.every((node) => node.options?.csr === false)
				? skipClient(project, context, serverManifest, component)
				: await buildClient(builder, project, context, serverManifest, component);
			writeNodes(context);
			full();
			replaceManifest(server, serverSources, context);
			const rendered = await prerenderBuild(context, project.vite.configFile || undefined);
			context.prerendered = rendered.prerendered;
			context.prerenderMap = rendered.prerenderMap;
			context.manifest.prerendered.push(
				...rendered.prerendered.paths.map((path) => ({
					path: path.slice(project.config.paths.base.length + 1)
				}))
			);
			replaceManifest(client, clientSources, context);
			if (context.artifacts.client?.inline)
				context.artifacts.client.inline.script = manifestCode(inlineScript, context);
			for (const file of inlined) rmSync(path.join(client, file), { force: true });
			replaceManifest(server, serverSources, context);
			await pruneRemotes(project);
			createBuilder(context).generateEnvModule();
			if (project.serviceWorker) {
				const serviceWorker = builder.environments.serviceWorker!;
				serviceWorker.config.experimental.renderBuiltUrl = (filename) => ({
					runtime: `new URL(${JSON.stringify(filename)}, location.href).pathname`
				});
				refuseClientModules(await builder.build(serviceWorker));
				context.artifacts.serviceWorker = 'service-worker.js';
			}
			full();
			write(
				path.join(server, 'manifest.js'),
				'export const manifest = ' +
					manifestSource({
						context,
						routes: project.tree.routes.filter(
							(route) =>
								(route.page || route.endpoint) && context.prerenderMap.get(route.id) !== true
						),
						relativePath: '.'
					}) +
					';'
			);
			write(
				path.join(output, 'prerendered.json'),
				JSON.stringify({
					pages: [...context.prerendered.pages],
					assets: [...context.prerendered.assets],
					redirects: [...context.prerendered.redirects],
					paths: context.prerendered.paths
				})
			);
			if (project.config.adapter) await project.config.adapter.adapt(createBuilder(context));
		}
	};
}
