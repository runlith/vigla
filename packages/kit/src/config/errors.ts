import { throwDiagnostic } from '../shared/diagnostics.ts';

interface KeyPath {
	keypath: string;
}
interface Extension extends KeyPath {
	extension: string;
}
interface Origin extends KeyPath {
	input: string;
}
interface Unexpected extends KeyPath {
	suggestion?: string;
}

export function config_not_object(): never {
	return throwDiagnostic(
		'config_not_object',
		'The SvelteKit options from the Vite config must be an object',
		config_not_object
	);
}
export function config_expected_object({ keypath }: KeyPath): never {
	return throwDiagnostic(
		'config_expected_object',
		`\`${keypath}\` should be an object`,
		config_expected_object
	);
}
export function config_expected_string({ keypath }: KeyPath): never {
	return throwDiagnostic(
		'config_expected_string',
		`\`${keypath}\` should be a string, if specified`,
		config_expected_string
	);
}
export function config_expected_string_array({ keypath }: KeyPath): never {
	return throwDiagnostic(
		'config_expected_string_array',
		`\`${keypath}\` should be an array of strings, if specified`,
		config_expected_string_array
	);
}
export function config_expected_number({ keypath }: KeyPath): never {
	return throwDiagnostic(
		'config_expected_number',
		`\`${keypath}\` should be a number, if specified`,
		config_expected_number
	);
}
export function config_expected_boolean({ keypath }: KeyPath): never {
	return throwDiagnostic(
		'config_expected_boolean',
		`\`${keypath}\` should be true or false, if specified`,
		config_expected_boolean
	);
}
export function config_expected_function({ keypath }: KeyPath): never {
	return throwDiagnostic(
		'config_expected_function',
		`\`${keypath}\` should be a function, if specified`,
		config_expected_function
	);
}
export function config_expected_positive_integer({ keypath }: KeyPath): never {
	return throwDiagnostic(
		'config_expected_positive_integer',
		`\`${keypath}\` should be a positive integer, if specified`,
		config_expected_positive_integer
	);
}
export function config_expected_one_of({ keypath, options }: KeyPath & { options: string }): never {
	return throwDiagnostic(
		'config_expected_one_of',
		`\`${keypath}\` should be ${options}`,
		config_expected_one_of
	);
}
export function config_unexpected_option({ keypath, suggestion }: Unexpected): never {
	return throwDiagnostic(
		'config_unexpected_option',
		`Unexpected option \`${keypath}\`${suggestion ? ` (did you mean \`${suggestion}\`?)` : ''}`,
		config_unexpected_option
	);
}
export function config_empty_string({ keypath }: KeyPath): never {
	return throwDiagnostic(
		'config_empty_string',
		`\`${keypath}\` cannot be empty`,
		config_empty_string
	);
}
export function config_app_dir_slash({ keypath }: KeyPath): never {
	return throwDiagnostic(
		'config_app_dir_slash',
		`\`${keypath}\` cannot start or end with '/'`,
		config_app_dir_slash
	);
}
export function config_extension_missing_dot({ keypath, extension }: Extension): never {
	return throwDiagnostic(
		'config_extension_missing_dot',
		`Each member of ${keypath} must start with '.' — saw '${extension}'`,
		config_extension_missing_dot
	);
}
export function config_extension_invalid({ extension }: { extension: string }): never {
	return throwDiagnostic(
		'config_extension_invalid',
		`File extensions must be alphanumeric — saw '${extension}'`,
		config_extension_invalid
	);
}
export function config_invalid_adapter({ keypath }: KeyPath): never {
	return throwDiagnostic(
		'config_invalid_adapter',
		`The SvelteKit Vite plugin \`${keypath}\` should be an object with an \`adapt\` method`,
		config_invalid_adapter
	);
}
export function config_invalid_prerender_handler({ keypath }: KeyPath): never {
	return throwDiagnostic(
		'config_invalid_prerender_handler',
		`\`${keypath}\` should be 'fail', 'warn', 'ignore' or a custom function`,
		config_invalid_prerender_handler
	);
}
export function config_paths_base_invalid({ keypath }: KeyPath): never {
	return throwDiagnostic(
		'config_paths_base_invalid',
		`\`${keypath}\` option must either be the empty string or a root-relative path that starts but doesn't end with '/'`,
		config_paths_base_invalid
	);
}
export function config_paths_assets_not_absolute({ keypath }: KeyPath): never {
	return throwDiagnostic(
		'config_paths_assets_not_absolute',
		`\`${keypath}\` option must be an absolute path, if specified`,
		config_paths_assets_not_absolute
	);
}
export function config_paths_assets_trailing_slash({ keypath }: KeyPath): never {
	return throwDiagnostic(
		'config_paths_assets_trailing_slash',
		`\`${keypath}\` option must not end with '/'`,
		config_paths_assets_trailing_slash
	);
}
export function config_origin_invalid({ keypath, input }: Origin): never {
	return throwDiagnostic(
		'config_origin_invalid',
		`\`${keypath}\` must be a valid origin (e.g. 'https://my-site.com'). '${input}' could not be parsed as a URL`,
		config_origin_invalid
	);
}
export function config_origin_protocol({
	keypath,
	protocol
}: KeyPath & { protocol: string }): never {
	return throwDiagnostic(
		'config_origin_protocol',
		`\`${keypath}\` must be a valid origin — only 'http' and 'https' protocols are supported, received '${protocol}'`,
		config_origin_protocol
	);
}
export function config_origin_has_path({
	keypath,
	input,
	origin
}: Origin & { origin: string }): never {
	return throwDiagnostic(
		'config_origin_has_path',
		`\`${keypath}\` must be a valid origin — received '${input}' which contains a path, query, or hash. Use the bare origin '${origin}' instead`,
		config_origin_has_path
	);
}
export function config_prerender_entry_invalid({
	keypath,
	entry
}: KeyPath & { entry: string }): never {
	return throwDiagnostic(
		'config_prerender_entry_invalid',
		`Each member of \`${keypath}\` must be either '*' or an absolute path beginning with '/' — saw '${entry}'`,
		config_prerender_entry_invalid
	);
}
export function config_kit_namespace({ keys }: { keys: string }): never {
	return throwDiagnostic(
		'config_kit_namespace',
		`SvelteKit configuration (${keys}) no longer lives inside a \`kit\` namespace. Pass it directly to the \`sveltekit(...)\` Vite plugin`,
		config_kit_namespace
	);
}
export function config_option_removed({ keypath }: KeyPath): never {
	return throwDiagnostic(
		'config_option_removed',
		`The \`${keypath}\` option has been removed. Please see the list of breaking changes for your major release`,
		config_option_removed
	);
}
export function config_option_removed_check_origin({ keypath }: KeyPath): never {
	return throwDiagnostic(
		'config_option_removed_check_origin',
		`\`${keypath}\` has been removed in favour of \`csrf.trustedOrigins\``,
		config_option_removed_check_origin
	);
}
export function config_option_removed_experimental_tracing({ keypath }: KeyPath): never {
	return throwDiagnostic(
		'config_option_removed_experimental_tracing',
		`\`${keypath}\` has been removed. Server-side tracing is now configured via \`tracing.server\``,
		config_option_removed_experimental_tracing
	);
}
export function config_option_removed_experimental_instrumentation({ keypath }: KeyPath): never {
	return throwDiagnostic(
		'config_option_removed_experimental_instrumentation',
		`\`${keypath}\` has been removed. \`src/instrumentation.server.js\` is now included in the build automatically when it exists; no opt-in is required`,
		config_option_removed_experimental_instrumentation
	);
}
export function config_option_removed_files_lib({ keypath }: KeyPath): never {
	return throwDiagnostic(
		'config_option_removed_files_lib',
		`\`${keypath}\` has been removed. Use \`#lib\` instead of \`$lib\`: https://svelte.dev/docs/kit/$lib`,
		config_option_removed_files_lib
	);
}
export function config_option_removed_preload_strategy({ keypath }: KeyPath): never {
	return throwDiagnostic(
		'config_option_removed_preload_strategy',
		`\`${keypath}\` has been removed. \`modulepreload\` will always be used`,
		config_option_removed_preload_strategy
	);
}
export function config_option_removed_prerender_origin({ keypath }: KeyPath): never {
	return throwDiagnostic(
		'config_option_removed_prerender_origin',
		`\`${keypath}\` has been removed in favour of \`config.paths.origin\``,
		config_option_removed_prerender_origin
	);
}
export function config_option_removed_vite_plugin({ keypath }: KeyPath): never {
	return throwDiagnostic(
		'config_option_removed_vite_plugin',
		`\`${keypath}\` has been removed. Pass plugin options directly to the \`sveltekit(...)\` Vite plugin`,
		config_option_removed_vite_plugin
	);
}
export function config_server_resolution_hash(): never {
	return throwDiagnostic(
		'config_server_resolution_hash',
		"The `router.resolution` option cannot be 'server' if `router.type` is 'hash'",
		config_server_resolution_hash
	);
}
export function config_server_resolution_bundle_strategy(): never {
	return throwDiagnostic(
		'config_server_resolution_bundle_strategy',
		"The `router.resolution` option cannot be 'server' if `output.bundleStrategy` is 'inline' or 'single'",
		config_server_resolution_bundle_strategy
	);
}
export function config_csp_trusted_types_missing(): never {
	return throwDiagnostic(
		'config_csp_trusted_types_missing',
		"The `csp.directives['trusted-types']` option must include 'sveltekit-trusted-url' when `serviceWorker.register` is `true`",
		config_csp_trusted_types_missing
	);
}
export function app_template_missing({ file }: { file: string }): never {
	return throwDiagnostic('app_template_missing', `${file} does not exist`, app_template_missing);
}
export function app_template_tag_missing({ file, tag }: { file: string; tag: string }): never {
	return throwDiagnostic(
		'app_template_tag_missing',
		`${file} is missing \`${tag}\``,
		app_template_tag_missing
	);
}
export function config_alias_key_invalid({ key }: { key: string }): never {
	return throwDiagnostic(
		'config_alias_key_invalid',
		`Invalid alias key: \`${key}\``,
		config_alias_key_invalid
	);
}
export function config_alias_value_invalid({ value }: { value: string }): never {
	return throwDiagnostic(
		'config_alias_value_invalid',
		`Invalid alias value: \`${value}\``,
		config_alias_value_invalid
	);
}
