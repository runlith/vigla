import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { lookup } from '../shared/mime.ts';
import { uneval } from 'devalue';
import type { Builder, Logger, RouteDefinition } from '../types/builder.ts';
import { compress, copy, remove, specifier, walk, write } from './files.ts';
import { initializer, instrument } from './instrument.ts';
import { manifestSource, serverAssets } from './manifest.ts';
import { BuildMessages } from './messages.ts';
import type { BuildContext } from './types.ts';
import { renderFallback } from './worker.ts';

export function createLogger(verbose = true): Logger {
	const log = (message: string) => console.log(message);
	const detail = (message: string) => {
		if (verbose) console.log(message);
	};
	return Object.assign(log, {
		success: log,
		error: (message: string) => console.error(message),
		warn: (message: string) => console.warn(message),
		minor: detail,
		info: detail,
		err: (message: string) => console.error(message),
		prettyError: (error: unknown, caller?: string) => console.error(caller ?? '', error)
	});
}

export function createBuilder(context: BuildContext): Builder {
	const { config, tree, analysis, artifacts, prerendered } = context;
	const e: BuildMessages = new BuildMessages(context.diagnostics);
	const output = path.join(config.outDir, 'output');
	const routes: RouteDefinition[] = tree.routes
		.filter((route) => route.page || route.endpoint)
		.map((route) => {
			const metadata = analysis.routes.get(route.id)!;
			return {
				id: route.id,
				api: metadata.api,
				page: metadata.page,
				segments: route.id
					.split('/')
					.filter((segment) => segment && !/^\(.+\)$/.test(segment))
					.map((content) => ({
						content,
						dynamic: content.includes('['),
						rest: content.includes('[...')
					})),
				pattern: route.pattern,
				prerender: context.prerenderMap.get(route.id) ?? false,
				methods: metadata.methods,
				config: metadata.config
			};
		});
	const manifest = {
		...context.manifest,
		assets: [
			...context.manifest.assets,
			...(artifacts.serviceWorker ? [{ path: artifacts.serviceWorker }] : [])
		]
	};
	const serverDirectory = path.join(output, 'server');
	const builder: Builder = {
		identity: context.identity,
		config,
		log: context.log,
		routes,
		prerendered,
		manifest,
		rimraf: remove,
		mkdirp(directory) {
			mkdirSync(directory, { recursive: true });
		},
		copy,
		compress,
		get mimeTypes() {
			const types = Object.fromEntries(
				tree.assets
					.filter((asset) => asset.type)
					.map((asset) => [path.extname(asset.file), asset.type!])
			);
			const files = [
				...serverAssets(
					context,
					tree.routes.filter((route) => context.prerenderMap.get(route.id) !== true)
				),
				...walk(path.join(output, 'client')),
				...walk(path.join(output, 'prerendered'))
			];
			for (const file of files) {
				const extension = path.extname(file);
				if (extension) types[extension] ??= lookup(file) ?? '';
			}
			return types;
		},
		findServerAssets(selected) {
			return serverAssets(
				context,
				selected.map((route) => tree.routes.find((candidate) => candidate.id === route.id)!)
			);
		},
		async generateFallback(destination) {
			const html = await renderFallback(context);
			if (existsSync(destination)) e.adapter_fallback_overwrites({ file: destination });
			write(destination, html);
		},
		generateEnvModule() {
			if (artifacts.client?.uses_env_dynamic_public)
				write(
					path.join(output, 'prerendered/dependencies', config.appDir, 'env.js'),
					`export const env = ${uneval(analysis.environment)};`
				);
		},
		generateManifest() {
			return e.adapter_generate_manifest_removed();
		},
		generateServerInstance(destination, options = {}) {
			const directory = options.serverDirectory ?? serverDirectory;
			const relative = specifier(path.dirname(destination), directory);
			const selected = options.routes
				? options.routes.map((route) => tree.routes.find((candidate) => candidate.id === route.id)!)
				: tree.routes.filter((route) => context.prerenderMap.get(route.id) !== true);
			write(
				destination,
				`import { create_server } from ${JSON.stringify(relative + '/index.js')};\nconst manifest = ${manifestSource({ context, routes: selected, relativePath: relative })};\nexport const server = create_server(manifest);\n`
			);
		},
		getBuildDirectory(name) {
			return path.join(config.outDir, name);
		},
		getClientDirectory() {
			return path.join(output, 'client');
		},
		getServerDirectory() {
			return serverDirectory;
		},
		getAppPath() {
			return [config.paths.base.slice(1), config.appDir].filter(Boolean).join('/');
		},
		writeClient(destination) {
			return copy(path.join(output, 'client'), destination, { filter: (name) => name !== '.vite' });
		},
		writeServer(destination) {
			return copy(serverDirectory, destination);
		},
		writePrerendered(destination) {
			return ['pages', 'dependencies', 'data'].flatMap((directory) =>
				copy(path.join(output, 'prerendered', directory), destination)
			);
		},
		createInstrumentationInitializer(options) {
			return initializer(options, serverDirectory);
		},
		hasServerInstrumentationFile() {
			return existsSync(path.join(serverDirectory, 'instrumentation.server.js'));
		},
		instrument(options) {
			instrument(options, e);
		}
	};
	return builder;
}
