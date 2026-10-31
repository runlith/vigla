import { DEV } from 'esm-env';
import { throwDiagnostic } from '../shared/diagnostics.ts';

interface Caller {
	caller: string;
}
interface Destination extends Caller {
	url: string;
}
interface Route {
	id: string;
}
interface Url {
	url: string;
}
interface Key {
	key: string;
}

export function navigation_before_start(values: Caller): never {
	if (DEV)
		throwDiagnostic(
			'navigation_before_start',
			`Cannot call \`${values.caller}(...)\` before router is initialized`,
			navigation_before_start
		);
	throw new Error('https://svelte.dev/e/kit/navigation_before_start');
}
export function navigation_external_url(values: Destination): never {
	if (DEV)
		throwDiagnostic(
			'navigation_external_url',
			`Cannot use \`${values.caller}\` with an external URL. Use \`window.location = "${values.url}"\` instead`,
			navigation_external_url
		);
	throw new Error('https://svelte.dev/e/kit/navigation_external_url');
}
export function navigation_route_missing(values: Destination): never {
	if (DEV)
		throwDiagnostic(
			'navigation_route_missing',
			`Cannot use \`${values.caller}\` with a URL that does not resolve to a route within the app. Use \`window.location = "${values.url}"\` instead`,
			navigation_route_missing
		);
	throw new Error('https://svelte.dev/e/kit/navigation_route_missing');
}
export function goto_options_removed(): never {
	if (DEV)
		throwDiagnostic(
			'goto_options_removed',
			'The `goto(..., { noScroll: true, keepFocus: true })` options have been replaced by `reset: false`',
			goto_options_removed
		);
	throw new Error('https://svelte.dev/e/kit/goto_options_removed');
}
export function redirect_loop(values: Url): never {
	if (DEV)
		throwDiagnostic(
			'redirect_loop',
			`Redirect loop while navigating to \`${values.url}\``,
			redirect_loop
		);
	throw new Error('https://svelte.dev/e/kit/redirect_loop');
}
export function reserved_query_parameter(values: Key): never {
	if (DEV)
		throwDiagnostic(
			'reserved_query_parameter',
			`Cannot use reserved query parameter \`${values.key}\``,
			reserved_query_parameter
		);
	throw new Error('https://svelte.dev/e/kit/reserved_query_parameter');
}
export function scroll_handling_outside_navigation(): never {
	if (DEV)
		throwDiagnostic(
			'scroll_handling_outside_navigation',
			'Can only disable scroll handling during navigation',
			scroll_handling_outside_navigation
		);
	throw new Error('https://svelte.dev/e/kit/scroll_handling_outside_navigation');
}
export function preload_invalid_route_id(values: Route): never {
	if (DEV)
		throwDiagnostic(
			'preload_invalid_route_id',
			`\`preloadCode\` expects a route ID starting with \`/\`, but received \`${values.id}\``,
			preload_invalid_route_id
		);
	throw new Error('https://svelte.dev/e/kit/preload_invalid_route_id');
}
export function preload_url_outside_app(values: Url): never {
	if (DEV)
		throwDiagnostic(
			'preload_url_outside_app',
			`Attempted to preload a URL that does not belong to this app: \`${values.url}\``,
			preload_url_outside_app
		);
	throw new Error('https://svelte.dev/e/kit/preload_url_outside_app');
}
export function snapshot_duplicate_id(values: { id: string }): never {
	if (DEV)
		throwDiagnostic(
			'snapshot_duplicate_id',
			`A snapshot with id \`${values.id}\` is already registered. Pass a unique \`id\`.`,
			snapshot_duplicate_id
		);
	throw new Error('https://svelte.dev/e/kit/snapshot_duplicate_id');
}
export function snapshot_id_missing(): never {
	if (DEV)
		throwDiagnostic(
			'snapshot_id_missing',
			'Could not generate a snapshot id from the stack trace. Pass an `id` instead.',
			snapshot_id_missing
		);
	throw new Error('https://svelte.dev/e/kit/snapshot_id_missing');
}
export function enhance_invalid_method(): never {
	if (DEV)
		throwDiagnostic(
			'enhance_invalid_method',
			'`use:enhance` can only be used on `<form>` elements with `method="POST"`',
			enhance_invalid_method
		);
	throw new Error('https://svelte.dev/e/kit/enhance_invalid_method');
}
export function enhance_file_without_enctype(): never {
	if (DEV)
		throwDiagnostic(
			'enhance_file_without_enctype',
			'Your form contains `<input type="file">` fields, but is missing the necessary `enctype="multipart/form-data"` attribute',
			enhance_file_without_enctype
		);
	throw new Error('https://svelte.dev/e/kit/enhance_file_without_enctype');
}
