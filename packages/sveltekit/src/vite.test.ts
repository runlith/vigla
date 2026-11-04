import { expect, test, vi } from 'vitest';
import { sveltekit } from './vite.ts';

test.each([
	[{ kit: { outDir: 'out' } }, 'config_kit_namespace', '`outDir`'],
	[
		{ csrf: { checkOrigin: false } },
		'config_option_removed_check_origin',
		'config.csrf.checkOrigin'
	],
	[{ files: { lib: 'lib' } }, 'config_option_removed_files_lib', 'config.files.lib'],
	[
		{ experimental: { tracing: true } },
		'config_option_removed_experimental_tracing',
		'config.experimental.tracing'
	],
	[
		{ output: { preloadStrategy: 'preload-js' } },
		'config_option_removed_preload_strategy',
		'config.output.preloadStrategy'
	],
	[{ serviceWorker: { files: () => true } }, 'config_option_removed', 'config.serviceWorker.files'],
	[{ vitePlugin: {} }, 'config_option_removed_vite_plugin', 'config.vitePlugin']
])('rejects the retired option %o with upstream diagnostic', async (input, code, keypath) => {
	const messages: string[] = [];
	const log = vi
		.spyOn(console, 'log')
		.mockImplementation((message) => messages.push(String(message)));
	try {
		await expect(sveltekit(input as never)).rejects.toThrow(
			'Failed to load SvelteKit options from Vite config'
		);
		const message = messages.join('\n');
		expect(message).toContain(code);
		expect(message).toContain(keypath);
		expect(message).toContain(`https://svelte.dev/e/kit/${code}`);
	} finally {
		log.mockRestore();
	}
});

test("the configured adapter's builder keeps Kit's members and raises upstream's removed generateManifest", async () => {
	let received: { generateManifest(): string; getAppPath(): string } | undefined;
	const plugins = await sveltekit({
		adapter: {
			name: 'retired',
			adapt(builder) {
				received = builder as never;
			}
		}
	});
	const setup = plugins.find((plugin) => plugin.name === 'kit:setup')!;
	await setup.api.options.adapter.adapt({ getAppPath: () => '_app', config: {} });
	expect(received!.getAppPath()).toBe('_app');
	expect(() => received!.generateManifest()).toThrow(
		'adapter_generate_manifest_removed\nThe `generateManifest` adapter API has been removed'
	);
});

test("an invalid adapter fails with upstream's whole diagnostic naming SvelteKit", async () => {
	const messages: string[] = [];
	const log = vi
		.spyOn(console, 'log')
		.mockImplementation((message) => messages.push(String(message)));
	try {
		await expect(sveltekit({ adapter: {} as never })).rejects.toThrow(
			'Failed to load SvelteKit options from Vite config'
		);
		expect(messages.join('\n').trim()).toBe(
			'config_invalid_adapter\nThe SvelteKit Vite plugin `config.adapter` should be an object with an `adapt` method\nhttps://svelte.dev/e/kit/config_invalid_adapter'
		);
	} finally {
		log.mockRestore();
	}
});

test('reading config.kit inside an adapter warns once with upstream text and returns the config', async () => {
	const messages: string[] = [];
	const warn = vi
		.spyOn(console, 'warn')
		.mockImplementation((message) => messages.push(String(message)));
	try {
		let received: { config: { kit?: unknown } } | undefined;
		const plugins = await sveltekit({
			adapter: {
				name: 'retired',
				adapt(builder) {
					received = builder as never;
				}
			}
		});
		const setup = plugins.find((plugin) => plugin.name === 'kit:setup')!;
		const config = { appDir: '_app' };
		await setup.api.options.adapter.adapt({ config });
		expect(received!.config.kit).toBe(config);
		expect(received!.config.kit).toBe(config);
		expect(messages).toEqual([
			'%c[sveltekit] adapter_config_kit_deprecated\n%cReading `config.kit` inside adapters is deprecated — it should access configuration on the `config` object directly. You may need to update your adapter\nhttps://svelte.dev/e/kit/adapter_config_kit_deprecated'
		]);
	} finally {
		warn.mockRestore();
	}
});

test('deprecated options warn under SvelteKit and still configure the app', async () => {
	const messages: string[] = [];
	const warn = vi
		.spyOn(console, 'warn')
		.mockImplementation((message) => messages.push(String(message)));
	try {
		const plugins = await sveltekit({
			alias: { '@lib': 'source/lib' },
			typescript: { config: (value) => value }
		});
		expect(plugins.length).toBeGreaterThan(0);
		expect(messages.join('\n')).toContain('[sveltekit] config_option_deprecated_alias');
		expect(messages.join('\n')).toContain('[sveltekit] config_option_deprecated_typescript');
	} finally {
		warn.mockRestore();
	}
});
