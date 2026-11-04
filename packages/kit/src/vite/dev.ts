import { existsSync, statSync } from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import path from 'node:path';
import type { Connect, EnvironmentModuleNode, RunnableDevEnvironment, ViteDevServer } from 'vite';
import { createReadableStream, getRequest, setResponse } from '../node/index.ts';
import type { RouteTree } from '../types/internal/routes.ts';
import type { ConfiguredServer, ServerManifest, ServerModule } from '../types/internal/server.ts';
import { outsideBase, serveAsset } from './assets.ts';
import {
	loadEnvironment,
	validateEnvironment,
	isRunnable,
	resolveEntry,
	SyncErrors
} from '../sync/index.ts';
import { clientDirectory, ids, virtualDirectory } from './ids.ts';
import { ViteMessages } from './messages.ts';
import { fileUrl, moduleUrl, posix } from './paths.ts';
import type { Project } from './project.ts';
import { importsUniversal } from './server.ts';

const scope = new AsyncLocalStorage();

interface DevelopmentModule extends ServerModule {
	manifest: ServerManifest;
}

interface EnvironmentModule {
	set_env(env: Record<string, string | undefined>): Promise<unknown>;
}

interface RunningServer {
	module: DevelopmentModule;
	instance: ConfiguredServer;
	ready: Promise<void>;
}

async function validateMatchers(
	tree: RouteTree,
	root: string,
	environment: RunnableDevEnvironment,
	e: ViteMessages
): Promise<void> {
	const names = new Set(
		tree.routes.flatMap((route) =>
			route.params.flatMap((param) => (param.matcher ? [param.matcher] : []))
		)
	);
	if (!names.size) return;
	if (!tree.params) e.param_matcher_missing({ name: names.values().next().value! });
	const module = await environment.runner.import(path.resolve(root, tree.params));
	if (!module.params || typeof module.params !== 'object')
		e.params_export_missing({ file: tree.params });
	for (const name of names)
		if (!Object.hasOwn(module.params, name)) e.param_matcher_missing({ name, file: tree.params });
}

async function styles(
	project: Project,
	environment: RunnableDevEnvironment,
	files: Array<string | undefined>
): Promise<Record<string, string>> {
	const seen = new Set<EnvironmentModuleNode>();
	const modules: EnvironmentModuleNode[] = [];
	async function visit(module: EnvironmentModuleNode): Promise<void> {
		if (seen.has(module) || /[?&](raw|url|inline)(?:&|$)/.test(module.url)) return;
		seen.add(module);
		const transformed = module.transformResult;
		if (transformed) {
			for (const url of [...(transformed.deps ?? []), ...(transformed.dynamicDeps ?? [])]) {
				const child = await environment.moduleGraph.getModuleByUrl(url);
				if (child) await visit(child);
			}
		} else for (const child of module.importedModules) await visit(child);
		if (project.api.isCSSRequest(module.url)) modules.push(module);
	}
	for (const file of files) {
		if (!file) continue;
		const module = await environment.moduleGraph.getModuleByUrl(moduleUrl(file, project.root));
		if (module) await visit(module);
	}
	const output: Record<string, string> = {};
	for (const module of modules) {
		const url = module.url.includes('?')
			? module.url.replace('?', '?inline&')
			: module.url + '?inline';
		const loaded = await environment.runner.import(url);
		if (typeof loaded.default === 'string') output[module.url] = loaded.default;
	}
	return output;
}

export async function configureDev(server: ViteDevServer, project: Project): Promise<() => void> {
	const e: ViteMessages = new ViteMessages(project.diagnostics);
	const syncErrors: SyncErrors = new SyncErrors(project.diagnostics);
	const environment = server.environments.ssr;
	if (!isRunnable(environment)) syncErrors.vite_ssr_environment_not_runnable();
	const fixStack = (error: Error) => {
		if (error.stack) Reflect.set(error, 'stack', error.stack.replaceAll('\0', ''));
		return error;
	};
	let current: RunningServer | undefined;
	let pending = Promise.resolve();
	let syncError: unknown;
	const invalidate = () => {
		for (const env of Object.values(server.environments)) {
			for (const [id, module] of env.moduleGraph.idToModuleMap) {
				if (
					id.startsWith(virtualDirectory) ||
					id.startsWith(clientDirectory(project.config, project.vite) + '/')
				)
					env.moduleGraph.invalidateModule(module);
			}
		}
		const evaluated = environment.runner.evaluatedModules;
		const seen = new Set<string>();
		const invalidateRunner = (id: string) => {
			if (seen.has(id)) return;
			seen.add(id);
			const module = evaluated.getModuleById(id);
			if (!module) return;
			for (const importer of module.importers) invalidateRunner(importer);
			evaluated.invalidateModule(module);
		};
		for (const id of evaluated.idToModuleMap.keys())
			if (
				id.startsWith(virtualDirectory) ||
				id.startsWith(clientDirectory(project.config, project.vite) + '/')
			)
				invalidateRunner(id);
		current = undefined;
	};
	function schedule(type: string, file: string): void {
		const { config } = project;
		const changed = posix(file);
		if (changed.startsWith(posix(config.outDir) + '/')) return;
		const relevant =
			[config.files.routes, config.files.assets].some((directory) =>
				changed.startsWith(posix(directory) + '/')
			) ||
			[
				config.files.params,
				...Object.values(config.files.hooks),
				config.files.serviceWorker,
				path.join(config.files.src, 'env')
			].some((entry) => changed === posix(entry) || changed.startsWith(posix(entry) + '.')) ||
			changed === posix(config.files.appTemplate) ||
			changed === posix(config.files.errorTemplate) ||
			project.environment.dependencies.has(file);
		if (!relevant) return;
		pending = pending
			.then(async () => {
				project.tree =
					type === 'change' ? await project.sync.update(file) : await project.sync.resync();
				if (
					project.environment.dependencies.has(file) ||
					changed.startsWith(posix(path.join(config.files.src, 'env')) + '.')
				) {
					const environment = await loadEnvironment(
						config,
						project.root,
						server.config.mode,
						project.api,
						project.diagnostics
					);
					project.environment = environment;
				}
				project.sync.writeEnvironment(project.environment.file, project.environment.variables);
				project.serviceWorker = resolveEntry(config.files.serviceWorker, config.moduleExtensions);
				invalidate();
				syncError = undefined;
				if (type !== 'change' || changed === posix(config.files.appTemplate))
					server.environments.client?.hot.send({ type: 'full-reload' });
			})
			.catch((error: unknown) => {
				syncError = error;
				const failure = error instanceof Error ? error : new Error(String(error));
				server.config.logger.error(failure.message);
				server.environments.client?.hot.send({
					type: 'error',
					err: { message: failure.message, stack: failure.stack ?? '' }
				});
			});
	}
	server.watcher.on('add', (file) => schedule('add', file));
	server.watcher.on('unlink', (file) => schedule('unlink', file));
	server.watcher.on('change', (file) => schedule('change', file));
	const emulator = await project.config.adapter?.emulate?.();
	const sourceFile = (file: string): string | null => {
		const resolved = file.startsWith('/@fs/')
			? file.slice(4)
			: path.resolve(project.root, file.startsWith('/') ? '.' + file : file);
		return existsSync(resolved) &&
			statSync(resolved).isFile() &&
			project.api.isFileServingAllowed(resolved, server)
			? resolved
			: null;
	};
	const serverAssets = new Proxy<Record<string, number>>(
		{},
		{
			has: (_, file) => typeof file === 'string' && sourceFile(file) !== null,
			get: (_, file) => {
				const resolved = typeof file === 'string' && sourceFile(file);
				return resolved ? statSync(resolved).size : undefined;
			}
		}
	);
	const read = (file: string) => {
		const source = sourceFile(file);
		if (source) return createReadableStream(source);
		const directory = project.config.files.assets;
		const asset = path.resolve(directory, file.startsWith('/') ? file.slice(1) : file);
		return asset.startsWith(directory + path.sep) && existsSync(asset) && statSync(asset).isFile()
			? createReadableStream(asset)
			: null;
	};
	server.middlewares.use((request, response, next) => {
		try {
			const pathname = new URL(request.originalUrl ?? request.url ?? '/', 'http://kit.local')
				.pathname;
			if (!serveAsset(project, request, response, pathname)) next();
		} catch (error) {
			next(error);
		}
	});
	return () => {
		const staticFiles = server.middlewares.stack
			.map((layer) => layer.handle)
			.find(
				(handle): handle is Connect.NextHandleFunction =>
					typeof handle === 'function' && handle.name === 'viteServeStaticMiddleware'
			);
		for (let index = server.middlewares.stack.length - 1; index >= 0; index--) {
			const layer = server.middlewares.stack[index]!;
			if (
				'name' in layer.handle &&
				['viteServeStaticMiddleware', 'viteServePublicMiddleware'].includes(layer.handle.name)
			)
				server.middlewares.stack.splice(index, 1);
		}
		server.middlewares.use(async (request, response, next) => {
			if (response.writableEnded) return;
			try {
				const original = request.url;
				request.url = request.originalUrl ?? original;
				const base = `${server.config.server.https ? 'https' : 'http'}://${request.headers[':authority'] ?? request.headers.host}`;
				const pathname = decodeURI(new URL(request.url ?? '/', base).pathname);
				if (pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
					response.writeHead(404);
					response.end('not found');
					return;
				}
				if (
					project.config.paths.base &&
					pathname !== project.config.paths.base &&
					!pathname.startsWith(project.config.paths.base + '/')
				) {
					outsideBase(request, response, project.config.paths.base);
					return;
				}
				const file = path.resolve(
					project.root,
					pathname.slice(project.config.paths.base.length + 1)
				);
				if (
					staticFiles &&
					existsSync(file) &&
					statSync(file).isFile() &&
					project.api.isFileServingAllowed(file, server)
				) {
					request.url = original;
					staticFiles(request, response, next);
					return;
				}
				if (pathname === `${project.config.paths.base}/${project.config.appDir}/version.json`) {
					response.writeHead(200, {
						'content-type': 'application/json',
						'cache-control': 'no-store'
					});
					response.end(JSON.stringify({ version: project.config.version.name }));
					return;
				}
				if (pathname === `${project.config.paths.base}/service-worker.js`) {
					const file = project.serviceWorker;
					response.writeHead(file ? 200 : 404, { 'content-type': 'application/javascript' });
					response.end(
						file
							? `import '${(project.config.paths.base + fileUrl(file)).replace(/[\\']/g, '\\$&')}';`
							: 'not found'
					);
					return;
				}
				await pending;
				if (syncError) throw syncError;
				if (!current) {
					project.environment.values = project.api.loadEnv(
						server.config.mode,
						project.config.env.dir,
						''
					);
					validateEnvironment(project.environment, project.diagnostics);
				}
				const instrumentation = resolveEntry(
					path.join(project.config.files.src, 'instrumentation.server'),
					project.config.moduleExtensions
				);
				if (instrumentation) {
					const adapter = project.config.adapter;
					if (adapter && !adapter.supports?.instrumentation?.())
						e.adapter_instrumentation_unsupported({ file: instrumentation, adapter: adapter.name });
					const env = (await environment.runner.import(ids.env)) as EnvironmentModule;
					await env.set_env(project.environment.values);
					await environment.runner.import(instrumentation);
				}
				const loaded = (await environment.runner.import(ids.server)) as DevelopmentModule;
				if (loaded !== current?.module) {
					const tree = project.tree;
					loaded.manifest.server_assets = serverAssets;
					Object.defineProperty(loaded.manifest, 'remotes', {
						get: () =>
							Object.fromEntries(
								[...project.remote.entries].map(([id, entry]) => [
									id,
									() =>
										environment.runner.import(entry.file).then((module) => ({ default: module }))
								])
							)
					});
					loaded.manifest.nodes = loaded.manifest.nodes.map((load, index) => {
						const source = tree.nodes[index];
						return async () => {
							const node = await load();
							const component = node.component;
							let rendered = false;
							if (component)
								node.component = () => {
									rendered = true;
									return component();
								};
							node.inline_styles = () =>
								styles(project, environment, [
									rendered && source?.component
										? path.resolve(project.root, source.component)
										: undefined,
									importsUniversal(source)
										? path.resolve(project.root, source!.universal!)
										: undefined
								]);
							return node;
						};
					});
					const instance = await loaded.configure({
						manifest: loaded.manifest,
						env: project.environment.values,
						read,
						scope,
						assets: project.config.paths.assets
							? project.identity.assets
							: project.config.paths.base,
						fix_stack_trace: fixStack
					});
					const ready = instance
						.init()
						.then(() => validateMatchers(tree, project.root, environment, e));
					current = { module: loaded, instance, ready };
				}
				const active = current!;
				await active.ready;
				const node = project.config.adapter?.vite;
				const web = (node?.getRequest ?? getRequest)({ request, response, base });
				const result = await active.instance.respond(web, {
					getClientAddress: () => {
						const address = request.socket.remoteAddress;
						if (!address) throw new Error('Could not determine clientAddress');
						return address;
					},
					emulator,
					read
				});
				const send = () => (node?.setResponse ?? setResponse)(response, result);
				if (result.status === 404 && staticFiles) {
					let forwarded = false;
					response.once('close', () => {
						if (!forwarded) void result.body?.cancel();
					});
					request.url = original;
					staticFiles(request, response, () => {
						forwarded = true;
						send();
					});
				} else send();
			} catch (error) {
				const failure = fixStack(error instanceof Error ? error : new Error(String(error)));
				server.config.logger.error(failure.stack ?? failure.message);
				if (response.headersSent) {
					next(failure);
					return;
				}
				response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
				response.end(failure.stack ?? failure.message);
			}
		});
	};
}
