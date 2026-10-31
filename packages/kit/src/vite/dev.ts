import { existsSync, statSync } from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import path from 'node:path';
import type { EnvironmentModuleNode, RunnableDevEnvironment, ViteDevServer } from 'vite';
import { createReadableStream, getRequest, setResponse } from '../node/index.ts';
import type { Server } from '../types/request.ts';
import type { RouteTree } from '../types/internal/routes.ts';
import type {
	AsyncContext,
	RequestStore,
	ServerManifest,
	ServerOptions
} from '../types/internal/server.ts';
import { outsideBase, serveAsset } from './assets.ts';
import { loadEnvironment } from './env.ts';
import { ids, virtualDirectory } from './ids.ts';
import * as e from './messages.ts';
import { fileUrl, isRunnable, posix, resolveEntry } from './paths.ts';
import type { Project } from './project.ts';

interface ServerModule {
	Server: new (manifest: ServerManifest) => Server;
	manifest: ServerManifest;
	options: ServerOptions;
}

interface RunningServer {
	module: ServerModule;
	instance: Server;
	ready: Promise<void>;
}

async function validateMatchers(
	tree: RouteTree,
	root: string,
	environment: RunnableDevEnvironment
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
	function visit(module: EnvironmentModuleNode): void {
		if (seen.has(module)) return;
		seen.add(module);
		if (project.api.isCSSRequest(module.url) && !/[?&](raw|url|inline)(?:&|$)/.test(module.url))
			modules.push(module);
		for (const child of module.importedModules) visit(child);
	}
	for (const file of files) {
		if (!file) continue;
		for (const module of environment.moduleGraph.getModulesByFile(posix(file)) ?? []) visit(module);
	}
	const output: Record<string, string> = {};
	await Promise.all(
		modules.map(async (module) => {
			const url = module.url + (module.url.includes('?') ? '&inline' : '?inline');
			const loaded = await environment.runner.import(url);
			if (typeof loaded.default === 'string') output[module.url] = loaded.default;
		})
	);
	return output;
}

export async function configureDev(server: ViteDevServer, project: Project): Promise<() => void> {
	const environment = server.environments.ssr;
	if (!isRunnable(environment)) e.vite_ssr_environment_not_runnable();
	const storage = new AsyncLocalStorage<RequestStore>();
	const scope: AsyncContext = {
		run: (store, fn) => storage.run(store, fn),
		getStore: () => storage.getStore()
	};
	const fixStack = (error: Error) => {
		server.ssrFixStacktrace(error);
		if (error.stack) error.stack = error.stack.replaceAll('\0', '');
		return error;
	};
	let current: RunningServer | undefined;
	let pending = Promise.resolve();
	let syncError: unknown;
	const invalidate = () => {
		for (const env of Object.values(server.environments)) {
			for (const [id, module] of env.moduleGraph.idToModuleMap) {
				if (id.startsWith(virtualDirectory)) env.moduleGraph.invalidateModule(module);
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
			if (id.startsWith(virtualDirectory)) invalidateRunner(id);
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
				)
					project.environment = await loadEnvironment(config, project.root, server.config.mode);
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
	const read = (file: string) => {
		let resolved = file.startsWith('/@fs/')
			? file.slice(4)
			: path.resolve(project.config.files.assets, file);
		if (!existsSync(resolved) && file.startsWith('/'))
			resolved = path.resolve(project.root, `.${file}`);
		if (
			!existsSync(resolved) ||
			!statSync(resolved).isFile() ||
			!project.api.isFileServingAllowed(resolved, server)
		)
			return null;
		return createReadableStream(resolved);
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
							? `import ${JSON.stringify(project.config.paths.base + fileUrl(file))};`
							: 'not found'
					);
					return;
				}
				await pending;
				if (syncError) throw syncError;
				const loaded = (await environment.runner.import(ids.server)) as unknown as ServerModule;
				if (loaded !== current?.module) {
					const tree = project.tree;
					loaded.options.fixStack = fixStack;
					loaded.manifest.nodes = loaded.manifest.nodes.map((load, index) => {
						const source = tree.nodes[index];
						return async () => {
							const node = await load();
							node.inline_styles = () =>
								styles(project, environment, [
									source?.component && path.resolve(project.root, source.component),
									source?.universal && path.resolve(project.root, source.universal)
								]);
							return node;
						};
					});
					const instance = new loaded.Server(loaded.manifest);
					const ready = instance
						.init({ env: project.environment.values, read, scope })
						.then(() => validateMatchers(tree, project.root, environment));
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
					platform: await emulator?.platform?.({ config: {}, prerender: false }),
					read
				});
				(node?.setResponse ?? setResponse)(response, result);
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
