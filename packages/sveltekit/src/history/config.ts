import { identity } from '../identity.ts';
import { throwDiagnostic, warnDiagnostic } from './diagnostics.ts';

type Step = [path: string, check: (keypath: string, value: unknown) => void];

const docs = 'https://svelte.dev/docs/kit/';

function removed(code: string, text: (keypath: string) => string): Step[1] {
	return (keypath) => throwDiagnostic(code, text(keypath), removed);
}

const generic = removed(
	'config_option_removed',
	(keypath) =>
		`The \`${keypath}\` option has been removed. Please see the list of breaking changes for your major release`
);

const steps: Step[] = [
	[
		'alias',
		(keypath) =>
			warnDiagnostic(
				'config_option_deprecated_alias',
				`The \`${keypath}\` option is deprecated, and will be removed in a future version of ${identity.product}. Use subpath imports instead: ${docs}$lib`
			)
	],
	[
		'csrf.checkOrigin',
		removed(
			'config_option_removed_check_origin',
			(keypath) => `\`${keypath}\` has been removed in favour of \`csrf.trustedOrigins\``
		)
	],
	[
		'experimental.tracing',
		removed(
			'config_option_removed_experimental_tracing',
			(keypath) =>
				`\`${keypath}\` has been removed. Server-side tracing is now configured via \`tracing.server\``
		)
	],
	[
		'experimental.instrumentation',
		removed(
			'config_option_removed_experimental_instrumentation',
			(keypath) =>
				`\`${keypath}\` has been removed. \`src/instrumentation.server.js\` is now included in the build automatically when it exists; no opt-in is required`
		)
	],
	['experimental.handleRenderingErrors', generic],
	[
		'files.lib',
		removed(
			'config_option_removed_files_lib',
			(keypath) => `\`${keypath}\` has been removed. Use \`#lib\` instead of \`$lib\`: ${docs}$lib`
		)
	],
	[
		'kit',
		(_, value) =>
			throwDiagnostic(
				'config_kit_namespace',
				`${identity.product} configuration (${Object.keys(value as object)
					.map((key) => `\`${key}\``)
					.join(
						', '
					)}) no longer lives inside a \`kit\` namespace. Pass it directly to the \`${identity.plugin}(...)\` Vite plugin`,
				checkConfig
			)
	],
	[
		'output.preloadStrategy',
		removed(
			'config_option_removed_preload_strategy',
			(keypath) => `\`${keypath}\` has been removed. \`modulepreload\` will always be used`
		)
	],
	[
		'prerender.origin',
		removed(
			'config_option_removed_prerender_origin',
			(keypath) => `\`${keypath}\` has been removed in favour of \`config.paths.origin\``
		)
	],
	['serviceWorker.files', generic],
	[
		'typescript',
		(keypath) =>
			warnDiagnostic(
				'config_option_deprecated_typescript',
				`The \`${keypath}\` option is deprecated, and will be removed in a future version. Add configuration to \`tsconfig.json\` directly`
			)
	],
	[
		'vitePlugin',
		removed(
			'config_option_removed_vite_plugin',
			(keypath) =>
				`\`${keypath}\` has been removed. Pass plugin options directly to the \`${identity.plugin}(...)\` Vite plugin`
		)
	]
];

function read(config: object, path: string): unknown {
	let value: unknown = config;
	for (const key of path.split('.')) {
		if (!value || typeof value !== 'object') return undefined;
		value = (value as Record<string, unknown>)[key];
	}
	return value;
}

export function checkConfig(config: unknown): void {
	if (!config || typeof config !== 'object' || Array.isArray(config)) return;
	try {
		for (const [path, check] of steps) {
			const value = read(config, path);
			if (value !== undefined) check(`config.${path}`, value);
		}
	} catch (error) {
		console.log(`\n${error instanceof Error ? error.message : String(error)}\n`);
		const failure = new Error(`Failed to load ${identity.product} options from Vite config`);
		failure.stack = '';
		throw failure;
	}
}
