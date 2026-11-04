import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import {
	loadErrorPage,
	loadTemplate,
	resolveConfig,
	splitConfig,
	validateConfig
} from './index.ts';

const directories: string[] = [];
function project(): string {
	const root = mkdtempSync(join(tmpdir(), 'config-'));
	directories.push(root);
	mkdirSync(join(root, 'source'), { recursive: true });
	return root;
}
afterEach(() => {
	for (const root of directories.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('fills defaults from files.src and resolves them against the Vite root without mutation', () => {
	const root = project();
	const config = validateConfig({
		files: { src: 'source', assets: 'public' },
		version: { name: 'fixed' }
	});
	const resolved = resolveConfig(config, root);
	expect(config.files.routes).toBe('source/routes');
	expect(resolved.files.routes).toBe(join(root, 'source/routes'));
	expect(resolved.files.hooks.server).toBe(join(root, 'source/hooks.server'));
	expect(resolved.files.assets).toBe(join(root, 'public'));
	expect(resolved.outDir).toBe(join(root, '.vigla'));
	expect(resolved.env.dir).toBe(root);
	expect(resolved.paths).toEqual({ base: '', assets: '', origin: undefined, relative: true });
	expect(resolved.output.bundleStrategy).toBe('split');
	expect(resolved.router).toEqual({ type: 'pathname', resolution: 'client' });
	expect(resolved.prerender.entries).toEqual(['*']);
	expect(resolved.extensions).toEqual([]);
});

test('separates plugin options and the shared experimental namespace', () => {
	expect(
		splitConfig({
			appDir: 'app',
			compilerOptions: { dev: true },
			experimental: { remoteFunctions: false, forkPreloads: true },
			inspector: true
		} as any)
	).toEqual({
		config: {
			appDir: 'app',
			compilerOptions: { dev: true },
			experimental: { remoteFunctions: false, forkPreloads: true }
		},
		plugin: { inspector: true }
	});
	expect(splitConfig({ experimental: { unknown: true } } as any)).toEqual({
		config: {},
		plugin: { experimental: { unknown: true } }
	});
});

test.each([
	[null, 'config_not_object', ''],
	[{ appDir: 42 }, 'config_expected_string', 'config.appDir'],
	[{ appDir: '' }, 'config_empty_string', 'config.appDir'],
	[{ appDir: '/app' }, 'config_app_dir_slash', 'config.appDir'],
	[{ files: { potato: 'x' } }, 'config_unexpected_option', 'config.files.potato'],
	[{ paths: false }, 'config_expected_object', 'config.paths'],
	[{ embedded: 1 }, 'config_expected_boolean', 'config.embedded'],
	[{ inlineStyleThreshold: '1' }, 'config_expected_number', 'config.inlineStyleThreshold'],
	[{ moduleExtensions: [1] }, 'config_expected_string_array', 'config.moduleExtensions'],
	[{ extensions: ['component'] }, 'config_extension_missing_dot', 'config.extensions'],
	[{ extensions: ['.s-velte'] }, 'config_extension_invalid', '.s-velte'],
	[{ adapter: () => {} }, 'config_invalid_adapter', 'config.adapter'],
	[{ csp: { mode: 'other' } }, 'config_expected_one_of', 'config.csp.mode'],
	[
		{ prerender: { concurrency: 0 } },
		'config_expected_positive_integer',
		'config.prerender.concurrency'
	],
	[
		{ prerender: { entries: ['relative'] } },
		'config_prerender_entry_invalid',
		'config.prerender.entries'
	],
	[
		{ prerender: { handleHttpError: true } },
		'config_invalid_prerender_handler',
		'config.prerender.handleHttpError'
	],
	[{ paths: { base: '/base/' } }, 'config_paths_base_invalid', 'config.paths.base'],
	[{ paths: { assets: '/static' } }, 'config_paths_assets_not_absolute', 'config.paths.assets'],
	[
		{ paths: { assets: 'https://cdn.test/' } },
		'config_paths_assets_trailing_slash',
		'config.paths.assets'
	],
	[{ paths: { origin: 'no-url' } }, 'config_origin_invalid', 'config.paths.origin'],
	[{ paths: { origin: 'file:///tmp' } }, 'config_origin_protocol', 'config.paths.origin'],
	[
		{ paths: { origin: 'https://site.test/path' } },
		'config_origin_has_path',
		'config.paths.origin'
	],
	[{ router: { resolution: 'server', type: 'hash' } }, 'config_server_resolution_hash', ''],
	[
		{ router: { resolution: 'server' }, output: { bundleStrategy: 'single' } },
		'config_server_resolution_bundle_strategy',
		''
	]
])('rejects invalid config with diagnostic %s', (input, code, keypath) => {
	const messages: string[] = [];
	const log = vi
		.spyOn(console, 'log')
		.mockImplementation((message) => messages.push(String(message)));
	try {
		expect(() => validateConfig(input)).toThrow('Failed to load Kit options from Vite config');
		expect(messages.join('\n')).toContain(code);
		expect(messages.join('\n')).toContain(keypath);
	} finally {
		log.mockRestore();
	}
});

test('validates all prerender concurrency boundaries', () => {
	const log = vi.spyOn(console, 'log').mockImplementation(() => {});
	try {
		for (const concurrency of [-1, 1.5, Infinity, NaN])
			expect(() => validateConfig({ prerender: { concurrency } })).toThrow();
		expect(validateConfig({ prerender: { concurrency: 2 } }).prerender.concurrency).toBe(2);
	} finally {
		log.mockRestore();
	}
});

test('keeps adapter plugin configuration on the validated adapter', () => {
	const adapter = {
		name: 'test',
		adapt() {},
		vite: ({ config }: any) => ({ plugins: [{ name: config.appDir }] })
	};
	const config = validateConfig({ appDir: 'custom', adapter });
	expect(config.adapter.vite).toEqual({ plugins: [{ name: 'custom' }] });
	expect(typeof adapter.vite).toBe('function');
});

test('requires trusted URL policy only when an enforced service worker exists', () => {
	const root = project();
	const config = validateConfig({
		files: { src: 'source' },
		csp: { directives: { 'require-trusted-types-for': ['script'] } }
	});
	expect(resolveConfig(config, root).serviceWorker.register).toBe(true);
	writeFileSync(join(root, 'source/service-worker.ts'), 'export {};');
	expect(() => resolveConfig(config, root)).toThrow('config_csp_trusted_types_missing');
});

test('loads the app template and diagnoses its missing placeholders', () => {
	const root = project();
	const config = resolveConfig(validateConfig({ files: { src: 'source' } }), root);
	expect(() => loadTemplate(root, config)).toThrow('app_template_missing');
	writeFileSync(config.files.appTemplate, '%vigla.head%');
	expect(() => loadTemplate(root, config)).toThrow('app_template_tag_missing');
	writeFileSync(config.files.appTemplate, '%vigla.head%|%vigla.body%');
	expect(loadTemplate(root, config)).toBe('%vigla.head%|%vigla.body%');
	expect(loadErrorPage(config)).toContain('%vigla.error.message%');
	writeFileSync(config.files.errorTemplate, 'custom error');
	expect(loadErrorPage(config)).toBe('custom error');
});
