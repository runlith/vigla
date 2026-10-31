import { BROWSER, DEV } from 'esm-env';
import { throwDiagnostic, verbose } from './diagnostics.ts';

interface StatusMessage {
	status: string;
}
interface LocationMessage {
	location: string;
}
interface KeyMessage {
	key: string;
}
interface NameMessage {
	name: string;
}
interface TypeMessage {
	type: string;
}
interface ExportMessage extends KeyMessage {
	exports: string;
	file?: string;
}
interface ExportLocation extends KeyMessage {
	locations: string;
	file?: string;
}
interface LoadMessage extends LocationMessage, TypeMessage {}
interface DuplicateField extends NameMessage {
	count: string;
}
interface RouteMessage {
	id: string;
}
interface RouteParam extends RouteMessage, NameMessage {}
interface HashOptions {
	source: string;
	options: string;
}

export function invalid_error_status(values: StatusMessage): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'invalid_error_status',
			`HTTP error status codes must be between 400 and 599 — ${values.status} is invalid`,
			invalid_error_status
		);
	throw new Error('https://svelte.dev/e/kit/invalid_error_status');
}
export function invalid_redirect_status(values: StatusMessage): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'invalid_redirect_status',
			`Redirect status codes must be between 300 and 308 — ${values.status} is invalid`,
			invalid_redirect_status
		);
	throw new Error('https://svelte.dev/e/kit/invalid_redirect_status');
}
export function redirect_external_not_allowed(values: LocationMessage): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'redirect_external_not_allowed',
			`Cannot redirect to external URL \`${values.location}\`. To redirect to an external URL, pass \`{ external: true }\` or an allowlist of permitted origins as the third argument to \`redirect\``,
			redirect_external_not_allowed
		);
	throw new Error('https://svelte.dev/e/kit/redirect_external_not_allowed');
}
export function redirect_external_javascript(values: LocationMessage): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'redirect_external_javascript',
			`Cannot redirect to \`${values.location}\` with \`{ external: true }\`. The \`javascript:\` and \`data:\` protocols must be explicitly listed in the \`external\` allowlist`,
			redirect_external_javascript
		);
	throw new Error('https://svelte.dev/e/kit/redirect_external_javascript');
}
export function redirect_external_not_in_allowlist(values: LocationMessage): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'redirect_external_not_in_allowlist',
			`Cannot redirect to \`${values.location}\`: URL origin is not included in the \`external\` allowlist`,
			redirect_external_not_in_allowlist
		);
	throw new Error('https://svelte.dev/e/kit/redirect_external_not_in_allowlist');
}
export function redirect_external_option_invalid(): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'redirect_external_option_invalid',
			'`redirect` `options.external` must be `true` or an array of allowed origins',
			redirect_external_option_invalid
		);
	throw new Error('https://svelte.dev/e/kit/redirect_external_option_invalid');
}
export function app_stores_removed(): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'app_stores_removed',
			'`$app/stores` has been removed in favour of `$app/state`',
			app_stores_removed
		);
	throw new Error('https://svelte.dev/e/kit/app_stores_removed');
}
export function service_worker_module_outside_worker(): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'service_worker_module_outside_worker',
			'The `$app/service-worker` module can only be imported into a service worker',
			service_worker_module_outside_worker
		);
	throw new Error('https://svelte.dev/e/kit/service_worker_module_outside_worker');
}
export function match_in_service_worker(): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'match_in_service_worker',
			'Cannot use `match(...)` inside a service worker, as it depends on the SvelteKit client instance',
			match_in_service_worker
		);
	throw new Error('https://svelte.dev/e/kit/match_in_service_worker');
}
export function resolve_params_missing(values: RouteMessage): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'resolve_params_missing',
			`Missing params for dynamic route ID \`${values.id}\``,
			resolve_params_missing
		);
	throw new Error('https://svelte.dev/e/kit/resolve_params_missing');
}
export function url_hash_unavailable(): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'url_hash_unavailable',
			'Cannot access `event.url.hash`. Consider using `page.url.hash` inside a component instead',
			url_hash_unavailable
		);
	throw new Error('https://svelte.dev/e/kit/url_hash_unavailable');
}
export function form_field_unbound(values: NameMessage): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'form_field_unbound',
			`Form contained a field that wasn't created with \`form.fields.as(...)\`: \`${values.name}\``,
			form_field_unbound
		);
	throw new Error('https://svelte.dev/e/kit/form_field_unbound');
}
export function form_field_duplicate(values: DuplicateField): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'form_field_duplicate',
			`Form cannot contain duplicated keys — \`${values.name}\` has ${values.count} values`,
			form_field_duplicate
		);
	throw new Error('https://svelte.dev/e/kit/form_field_duplicate');
}
export function form_field_invalid_name(values: NameMessage): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'form_field_invalid_name',
			`Invalid field name \`${values.name}\`: field names are written in JS object notation, so keys that would need quoting are not supported. See https://svelte.dev/docs/kit/remote-functions#form-Fields`,
			form_field_invalid_name
		);
	throw new Error('https://svelte.dev/e/kit/form_field_invalid_name');
}
export function form_field_forbidden_key(values: KeyMessage): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'form_field_forbidden_key',
			`Invalid key \`${values.key}\`: This key is not allowed to prevent prototype pollution.`,
			form_field_forbidden_key
		);
	throw new Error('https://svelte.dev/e/kit/form_field_forbidden_key');
}
export function form_field_array_conflict(values: KeyMessage): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'form_field_array_conflict',
			`Invalid array key \`${values.key}\``,
			form_field_array_conflict
		);
	throw new Error('https://svelte.dev/e/kit/form_field_array_conflict');
}
export function remote_argument_unsupported(values: TypeMessage): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'remote_argument_unsupported',
			`${values.type} are not valid remote function arguments`,
			remote_argument_unsupported
		);
	throw new Error('https://svelte.dev/e/kit/remote_argument_unsupported');
}
export function form_input_missing_value(values: TypeMessage): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'form_input_missing_value',
			`${values.type} inputs must have a value`,
			form_input_missing_value
		);
	throw new Error('https://svelte.dev/e/kit/form_input_missing_value');
}
export function load_invalid_response(values: LoadMessage): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'load_invalid_response',
			`a \`load\` function ${values.location} returned ${values.type}, but must return a plain object at the top level (i.e. \`return {...}\`)`,
			load_invalid_response
		);
	throw new Error('https://svelte.dev/e/kit/load_invalid_response');
}
export function param_matcher_async(): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'param_matcher_async',
			'Async param matchers are not supported',
			param_matcher_async
		);
	throw new Error('https://svelte.dev/e/kit/param_matcher_async');
}
export function param_matcher_result_invalid(): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'param_matcher_result_invalid',
			'Param matcher must return a string, number, boolean, or bigint',
			param_matcher_result_invalid
		);
	throw new Error('https://svelte.dev/e/kit/param_matcher_result_invalid');
}
export function param_definition_invalid(): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'param_definition_invalid',
			'Invalid param definition',
			param_definition_invalid
		);
	throw new Error('https://svelte.dev/e/kit/param_definition_invalid');
}
export function route_param_missing(values: RouteParam): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'route_param_missing',
			`Missing parameter \`${values.name}\` in route \`${values.id}\``,
			route_param_missing
		);
	throw new Error('https://svelte.dev/e/kit/route_param_missing');
}
export function route_param_slash(values: RouteParam): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'route_param_slash',
			`Parameter \`${values.name}\` in route \`${values.id}\` cannot start or end with a slash — this would cause an invalid route like \`foo/bar\``,
			route_param_slash
		);
	throw new Error('https://svelte.dev/e/kit/route_param_slash');
}
export function route_param_value_invalid(values: RouteParam): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'route_param_value_invalid',
			`Parameter \`${values.name}\` in route \`${values.id}\` must be a string, number, boolean, or bigint`,
			route_param_value_invalid
		);
	throw new Error('https://svelte.dev/e/kit/route_param_value_invalid');
}
export function invalid_export(values: ExportMessage): never {
	if (DEV || (!BROWSER && verbose)) {
		const source = values.file === undefined ? '' : ` in \`${values.file}\``;
		throwDiagnostic(
			'invalid_export',
			`Invalid export \`${values.key}\`${source} (valid exports are ${values.exports}, or anything with a \`'_'\` prefix)`,
			invalid_export
		);
	}
	throw new Error('https://svelte.dev/e/kit/invalid_export');
}
export function invalid_export_location(values: ExportLocation): never {
	if (DEV || (!BROWSER && verbose)) {
		const source = values.file === undefined ? '' : ` in \`${values.file}\``;
		throwDiagnostic(
			'invalid_export_location',
			`Invalid export \`${values.key}\`${source} (\`${values.key}\` is a valid export in ${values.locations})`,
			invalid_export_location
		);
	}
	throw new Error('https://svelte.dev/e/kit/invalid_export_location');
}
export function router_hash_page_options(values: HashOptions): never {
	if (DEV || (!BROWSER && verbose))
		throwDiagnostic(
			'router_hash_page_options',
			`Page options are ignored when \`router.type === 'hash'\` (\`${values.source}\` has ${values.options})`,
			router_hash_page_options
		);
	throw new Error('https://svelte.dev/e/kit/router_hash_page_options');
}
