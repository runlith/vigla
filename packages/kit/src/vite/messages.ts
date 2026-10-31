import { throwDiagnostic, warnDiagnostic } from '../shared/diagnostics.ts';

interface FileMessage {
	file: string;
}
interface NameMessage {
	name: string;
}
interface MatcherMessage {
	name: string;
	file?: string;
}
interface ImportMessage {
	module: string;
	chain: string;
}
interface EnvCycle {
	type: string;
	importer?: string;
}
interface ConfigMessage {
	options: string;
}
interface CorsMessage {
	key: string;
}
interface PluginsMessage {
	plugins: string;
}

export function config_file_unsupported({ file }: FileMessage): never {
	throwDiagnostic(
		'config_file_unsupported',
		`\`${file}\` is no longer used. Please pass configuration via the \`sveltekit(...)\` plugin in your Vite config.`,
		config_file_unsupported
	);
}
export function module_removed_lib(): never {
	throwDiagnostic(
		'module_removed_lib',
		"`$lib` has been removed. Use `#lib` instead: https://svelte.dev/docs/kit/$lib. To keep using `$lib`, add `alias: { '$lib': 'src/lib' }` to your SvelteKit config.",
		module_removed_lib
	);
}
export function module_removed_service_worker(): never {
	throwDiagnostic(
		'module_removed_service_worker',
		'`$service-worker` has been removed. Use `immutable`, `assets` and `prerendered` from `$app/manifest`, `version` from `$app/env`, and `resolve(...)` from `$app/paths` instead: https://svelte.dev/docs/kit/$service-worker',
		module_removed_service_worker
	);
}
export function server_only_import({ module, chain }: ImportMessage): never {
	throwDiagnostic(
		'server_only_import',
		`Cannot import \`${module}\` into code that runs in the browser, as this could leak sensitive information.\n\n${chain}\n\nIf you're only using the import as a type, change it to \`import type\`.`,
		server_only_import
	);
}
export function env_invalid_variable_name({ name }: NameMessage): never {
	throwDiagnostic(
		'env_invalid_variable_name',
		`Invalid environment variable name \`${name}\``,
		env_invalid_variable_name
	);
}
export function env_variables_missing({ file }: FileMessage): never {
	throwDiagnostic(
		'env_variables_missing',
		`\`${file}\` must export a variables object`,
		env_variables_missing
	);
}
export function env_app_import(): never {
	throwDiagnostic(
		'env_app_import',
		'Cannot import `$app/*` modules other than `$app/env` inside `src/env`',
		env_app_import
	);
}
export function env_circular_import({ type, importer }: EnvCycle): never {
	throwDiagnostic(
		'env_circular_import',
		importer
			? `Module \`${importer}\` imports \`$app/env/${type}\`, which creates a circular dependency with \`src/env\``
			: `Cannot import \`$app/env/${type}\` inside \`src/env\` or its dependencies because it creates a circular dependency`,
		env_circular_import
	);
}
export function vite_ssr_environment_not_runnable(): never {
	throwDiagnostic(
		'vite_ssr_environment_not_runnable',
		'The configured Vite SSR environment must be a `RunnableDevEnvironment`',
		vite_ssr_environment_not_runnable
	);
}
export function params_export_missing({ file }: FileMessage): never {
	throwDiagnostic(
		'params_export_missing',
		`\`${file}\` does not export \`params\` from \`defineParams\``,
		params_export_missing
	);
}
export function param_matcher_missing({ name, file }: MatcherMessage): never {
	throwDiagnostic(
		'param_matcher_missing',
		`No matcher found for parameter \`${name}\`${file ? ` in \`${file}\`` : ''}`,
		param_matcher_missing
	);
}
export function cors_preflight_continue({ key }: CorsMessage): void {
	warnDiagnostic(
		'cors_preflight_continue',
		`\`OPTIONS\` request handlers will not work unless \`${key}.preflightContinue\` is set to \`true\``
	);
}
export function transform_index_html_unsupported({ plugins }: PluginsMessage): void {
	warnDiagnostic(
		'transform_index_html_unsupported',
		`The following plugins may not work correctly because they use the \`transformIndexHtml\` hook which is not supported:\n${plugins}`
	);
}
export function vite_config_overridden({ options }: ConfigMessage): void {
	warnDiagnostic(
		'vite_config_overridden',
		`The following Vite config options will be overridden by SvelteKit:\n${options}`
	);
}
