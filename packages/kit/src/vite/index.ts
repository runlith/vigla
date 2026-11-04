import path from 'node:path';
import { vigla, type Options, type PluginAPI, type PluginFactory } from '@vigla/vite-plugin';
import type { CorsOptions, Plugin, ResolvedConfig, UserConfig } from 'vite';
import { resolveConfig, splitConfig, validateConfig } from '../config/index.ts';
import {
	createSync,
	installation,
	loadEnvironment,
	validateEnvironment,
	resolveEntry
} from '../sync/index.ts';
import { configAliases, importVite } from '../config/file.ts';
import type { Config, Framework } from '../types/config.ts';
import type { Identity } from '../types/identity.ts';
import type { ValidatedConfig } from '../types/builder.ts';
import { adopt, own } from '../shared/identity.ts';
import { configureDev } from './dev.ts';
import { namespace } from './ids.ts';
import * as e from './messages.ts';
import { scanVirtualModules, serverGuard, virtualModules } from './modules.ts';
import { importAliases, posix, packageDirectory, usesHtmlHook } from './paths.ts';
import type { Project } from './project.ts';
import { createRemotePlugin } from './remote.ts';
import { buildPlugin } from './build.ts';
import { configurePreview } from './preview.ts';

export type { Config, Framework } from '../types/config.ts';
export type { Identity, Links } from '../types/identity.ts';

function resolveCors(
	cors: CorsOptions | boolean | undefined,
	key: 'server.cors' | 'preview.cors',
	warn: boolean
): CorsOptions | undefined {
	if (cors === undefined) return key === 'server.cors' ? { preflightContinue: true } : undefined;
	if (cors === false) return undefined;
	if (typeof cors === 'object') {
		if (cors.preflightContinue === undefined) return { preflightContinue: true };
		if (cors.preflightContinue) return undefined;
	}
	if (warn) e.cors_preflight_continue({ key });
	return undefined;
}

function definitions(
	config: ValidatedConfig,
	identity: Identity,
	dev: boolean,
	worker: boolean,
	globalName: string
): Record<string, string> {
	const values: Record<string, unknown> = {
		__VIGLA_IDENTITY__: identity,
		__VIGLA_APP_DIR__: config.appDir,
		__VIGLA_APP_VERSION__: config.version.name,
		__VIGLA_APP_VERSION_CHECKS_ENABLED__: config.output.bundleStrategy !== 'inline',
		__VIGLA_APP_VERSION_POLL_INTERVAL__: dev ? 0 : config.version.pollInterval,
		__VIGLA_EMBEDDED__: config.embedded,
		__VIGLA_FORK_PRELOADS__: config.experimental.forkPreloads,
		__VIGLA_PATHS_ASSETS__: config.paths.assets,
		__VIGLA_PATHS_BASE__: config.paths.base,
		__VIGLA_PATHS_ORIGIN__: config.paths.origin,
		__VIGLA_PATHS_RELATIVE__: config.paths.relative,
		__VIGLA_CLIENT_ROUTING__: config.router.resolution === 'client',
		__VIGLA_HASH_ROUTING__: config.router.type === 'hash',
		__VIGLA_SERVER_TRACING_ENABLED__: config.tracing.server,
		__VIGLA_SUPPORTS_ASYNC__: true,
		__VIGLA_DEV__: dev,
		__VIGLA_GLOBAL_NAME__: globalName,
		__VIGLA_CSRF_CHECK_ORIGIN__: !config.csrf.trustedOrigins.includes('*'),
		__VIGLA_LINK_HEADER_PRELOAD__: config.output.linkHeaderPreload,
		__VIGLA_SERVICE_WORKER__: config.serviceWorker.register && worker,
		__VIGLA_HAS_SERVER_LOAD__: true,
		__VIGLA_HAS_UNIVERSAL_LOAD__: true
	};
	return {
		...Object.fromEntries(
			Object.entries(values).map(([key, value]) => [key, JSON.stringify(value) ?? 'undefined'])
		),
		__VIGLA_PAYLOAD__: `globalThis.${globalName}`
	};
}

export function createKit<O extends object>(
	identity: Identity,
	factory: PluginFactory<O>
): Framework<O> {
	return (input = {} as Config<O>) => {
		adopt(identity);
		return plugins(input as Config, factory as PluginFactory<object>, identity);
	};
}

export const kit: Framework<Options> = createKit(own, vigla);

async function plugins(
	input: Config,
	factory: PluginFactory<object>,
	identity: Identity
): Promise<Plugin[]> {
	const split = splitConfig(input);
	const validated = validateConfig(split.config);
	const options: Partial<Options> = { ...split.plugin, configFile: false };
	if (input.compilerOptions !== undefined) options.compilerOptions = input.compilerOptions;
	if (input.preprocess !== undefined) options.preprocess = input.preprocess;
	if (input.extensions !== undefined) options.extensions = input.extensions;
	const compiler = factory(options);
	const api = compiler.find((plugin) => plugin.name === factory.marker)!.api as PluginAPI;
	let root: string;
	let name: string;
	let dependency: string;
	let config: ValidatedConfig;
	let project: Project;
	let runtime: typeof import('vite');
	let globalName: string;
	let resolved: ResolvedConfig;
	let initialisation: Promise<Project> | undefined;
	const remote = createRemotePlugin(() => project);
	function initialise(): Promise<Project> {
		return (initialisation ??= (async () => {
			const sync = createSync(config, root);
			const tree = await sync.initial(resolved.mode);
			const environment = await loadEnvironment(config, root, resolved.mode, runtime);
			if (resolved.command === 'build') validateEnvironment(environment);
			sync.writeEnvironment(environment.file, environment.variables);
			const firstFormat = api.frontEnds[0]?.compiler.format;
			const sameFormat = api.frontEnds.every(
				({ compiler }) =>
					compiler.format?.global === firstFormat?.global &&
					compiler.format?.meta === firstFormat?.meta &&
					compiler.format?.cssWrapper === firstFormat?.cssWrapper
			);
			project = {
				root,
				name,
				global: globalName,
				remote,
				config,
				vite: resolved,
				api: runtime,
				sync,
				tree,
				environment,
				format: sameFormat ? firstFormat : undefined,
				serviceWorker: resolveEntry(config.files.serviceWorker, config.moduleExtensions)
			};
			return project;
		})());
	}
	const setup: Plugin = {
		name: 'kit:setup',
		enforce: 'pre',
		api: { options: validated },
		config: {
			order: 'pre',
			async handler(user, env) {
				root = posix(path.resolve(user.root ?? process.cwd()));
				runtime = await importVite(root);
				({ name, path: dependency } = installation(root));
				config = resolveConfig(validated, root);
				setup.api.options = config;
				const dev = env.command === 'serve';
				globalName = namespace(config.version.name, dev);
				const aliases = importAliases(root);
				const workspace = runtime.searchForWorkspaceRoot(root);
				const allow = new Set([
					config.files.routes,
					config.files.src,
					config.outDir,
					packageDirectory,
					path.join(root, 'node_modules'),
					path.join(workspace, 'node_modules'),
					...aliases.map((alias) => alias.path)
				]);
				if (user.server?.fs?.allow === undefined) allow.add(workspace);
				const hooks = resolveEntry(config.files.hooks.client, config.moduleExtensions);
				if (hooks) allow.add(path.dirname(hooks));
				const worker = resolveEntry(config.files.serviceWorker, config.moduleExtensions);
				const result: UserConfig = {
					appType: 'custom',
					base: config.paths.base || '/',
					publicDir: config.files.assets,
					define: definitions(config, identity, dev, !!worker, globalName),
					resolve: { alias: configAliases(config, root) },
					environments: {
						client: {
							consumer: 'client',
							resolve: { conditions: ['browser', 'module', 'development|production'] }
						},
						ssr: {
							consumer: 'server',
							resolve: { conditions: ['node', 'module', 'development|production'] },
							build: {
								sourcemap: user.environments?.ssr?.build?.sourcemap ?? user.build?.sourcemap ?? true
							}
						}
					},
					server: {
						cors: resolveCors(user.server?.cors, 'server.cors', dev),
						fs: { allow: [...allow] },
						watch: {
							ignored: [
								`${posix(config.outDir)}/!(generated)`,
								`${posix(config.outDir)}/!(generated)/**`
							]
						},
						sourcemapIgnoreList: (file) =>
							file.includes('node_modules') || file.includes(config.outDir)
					},
					preview: { cors: resolveCors(user.preview?.cors, 'preview.cors', dev) },
					optimizeDeps: {
						rolldownOptions: { plugins: [scanVirtualModules(), remote.scan] },
						entries: [
							`${config.files.routes}/**/+*.{js,ts}`,
							`!${config.files.routes}/**/+*server.*`
						],
						exclude: [name, '@vigla/kit', '$app', '$env'],
						include: [`${dependency} > devalue`, `${dependency} > esm-env`]
					},
					ssr: {
						noExternal: [name, '@vigla/kit', 'vigla', 'esm-env', 'devalue', 'cookie'],
						external: ['@opentelemetry/api']
					}
				};
				const overridden = (['appType', 'base', 'publicDir'] as const).filter(
					(key) => user[key] !== undefined && user[key] !== result[key]
				);
				if (overridden.length)
					e.vite_config_overridden({ options: overridden.map((key) => `  - ${key}`).join('\n') });
				return result;
			}
		},
		configResolved(vite) {
			resolved = vite;
			if (!input.extensions)
				config.extensions = [...new Set(api.frontEnds.flatMap((frontEnd) => frontEnd.components))];
			for (const env of Object.values(vite.environments)) {
				if (env.consumer !== 'client') continue;
				const entries = env.optimizeDeps.entries;
				if (Array.isArray(entries))
					entries.push(
						...config.extensions.map((extension) => `${config.files.routes}/**/+*${extension}`)
					);
			}
			const html = vite.plugins.filter(usesHtmlHook);
			if (html.length)
				e.transform_index_html_unsupported({
					plugins: html.map((plugin) => `  - ${plugin.name}`).join('\n')
				});
		},
		async buildStart() {
			await initialise();
		},
		async configureServer(server) {
			return configureDev(server, await initialise());
		},
		async configurePreviewServer(server) {
			return configurePreview(server, await initialise());
		}
	};
	return [
		...compiler,
		setup,
		serverGuard(() => config),
		virtualModules(
			() => config,
			() => project
		),
		...remote.plugins,
		buildPlugin(validated, initialise)
	];
}
