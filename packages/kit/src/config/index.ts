import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { Config } from '../types/config.ts';
import type { ValidatedConfig } from '../types/builder.ts';
import type { Diagnostics } from '../shared/diagnostics.ts';
import { configSchema } from './schema.ts';
import { ConfigErrors } from './errors.ts';

export interface SplitConfig {
	config: Config;
	plugin: Record<string, unknown>;
}

export function splitConfig(input: Config, d: Diagnostics): SplitConfig {
	const { schema, experimental } = configSchema(new ConfigErrors(d));
	const config: Record<string, unknown> = {};
	const plugin: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(input)) {
		if (key !== 'experimental') {
			(Object.hasOwn(schema, key) ? config : plugin)[key] = value;
			continue;
		}
		const flags = (value ?? {}) as Record<string, unknown>;
		for (const [flag, setting] of Object.entries(flags)) {
			const target = Object.hasOwn(experimental, flag) ? config : plugin;
			const group = (target.experimental ??= {}) as Record<string, unknown>;
			group[flag] = setting;
		}
	}
	return { config: config as Config, plugin };
}

export function validateConfig(input: unknown, d: Diagnostics): ValidatedConfig {
	const e: ConfigErrors = new ConfigErrors(d);
	try {
		if (!input || typeof input !== 'object' || Array.isArray(input)) e.config_not_object();
		const config = configSchema(e).parseOptions(input, 'config') as ValidatedConfig;
		config.outDir ??= d.identity.outDir;
		const files = config.files;
		files.hooks.client ??= join(files.src, 'hooks.client');
		files.hooks.server ??= join(files.src, 'hooks.server');
		files.hooks.universal ??= join(files.src, 'hooks');
		files.params ??= join(files.src, 'params');
		files.routes ??= join(files.src, 'routes');
		files.serviceWorker ??= join(files.src, 'service-worker');
		files.appTemplate ??= join(files.src, 'app.html');
		files.errorTemplate ??= join(files.src, 'error.html');
		if (config.router.resolution === 'server') {
			if (config.router.type === 'hash') e.config_server_resolution_hash();
			if (config.output.bundleStrategy !== 'split') e.config_server_resolution_bundle_strategy();
		}
		if (typeof config.adapter?.vite === 'function') {
			config.adapter = { ...config.adapter, vite: config.adapter.vite({ config }) };
		}
		return config;
	} catch (error) {
		console.log(`\n${error instanceof Error ? error.message : String(error)}\n`);
		const failure = new Error(`Failed to load ${d.identity.product} options from Vite config`);
		failure.stack = '';
		throw failure;
	}
}

function hasEntry(file: string, extensions: readonly string[]): boolean {
	const candidates = [
		file,
		...extensions.map((extension) => file + extension),
		...extensions.map((extension) => join(file, 'index' + extension))
	];
	return candidates.some((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

export function resolveConfig(
	config: ValidatedConfig,
	root: string,
	d: Diagnostics
): ValidatedConfig {
	const files = config.files;
	const resolved: ValidatedConfig = {
		...config,
		outDir: resolve(root, config.outDir),
		env: { ...config.env, dir: resolve(root, config.env.dir) },
		files: {
			...files,
			src: resolve(root, files.src),
			assets: resolve(root, files.assets),
			params: resolve(root, files.params),
			routes: resolve(root, files.routes),
			serviceWorker: resolve(root, files.serviceWorker),
			appTemplate: resolve(root, files.appTemplate),
			errorTemplate: resolve(root, files.errorTemplate),
			hooks: {
				client: resolve(root, files.hooks.client),
				server: resolve(root, files.hooks.server),
				universal: resolve(root, files.hooks.universal)
			}
		}
	};
	const directives = resolved.csp.directives;
	if (
		directives['require-trusted-types-for']?.includes('script') &&
		resolved.serviceWorker.register &&
		hasEntry(resolved.files.serviceWorker, resolved.moduleExtensions) &&
		!directives['trusted-types']?.includes(`${d.identity.name}-trusted-url`)
	)
		new ConfigErrors(d).config_csp_trusted_types_missing();
	return resolved;
}

export function loadErrorPage(config: ValidatedConfig, d: Diagnostics): string {
	if (existsSync(config.files.errorTemplate))
		return readFileSync(config.files.errorTemplate, 'utf8');
	const name = d.identity.name;
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>%${name}.error.message%</title><style>body{display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui,sans-serif}.error{display:flex;align-items:center;gap:1rem}.status{font-size:3rem;font-weight:200}.message{border-left:1px solid #ccc;padding-left:1rem}.message h1{font-size:1em;font-weight:400;margin:0}</style></head><body><div class="error"><span class="status">%${name}.status%</span><div class="message"><h1>%${name}.error.message%</h1></div></div></body></html>`;
}

export function loadTemplate(root: string, config: ValidatedConfig, d: Diagnostics): string {
	const e: ConfigErrors = new ConfigErrors(d);
	const file = relative(root, config.files.appTemplate);
	if (!existsSync(config.files.appTemplate)) e.app_template_missing({ file });
	const template = readFileSync(config.files.appTemplate, 'utf8');
	for (const tag of [`%${d.identity.name}.head%`, `%${d.identity.name}.body%`]) {
		if (!template.includes(tag)) e.app_template_tag_missing({ file, tag });
	}
	return template;
}
