import { DEV } from 'esm-env';
import { throwCode, throwDiagnostic } from '../shared/diagnostics.ts';

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
	throwCode('navigation_before_start');
}
export function navigation_external_url(values: Destination): never {
	if (DEV)
		throwDiagnostic(
			'navigation_external_url',
			`Cannot use \`${values.caller}\` with an external URL (${values.url}). Use \`window.location = "${values.url}"\` instead`,
			navigation_external_url
		);
	throwCode('navigation_external_url');
}
export function navigation_route_missing(values: Destination): never {
	if (DEV)
		throwDiagnostic(
			'navigation_route_missing',
			`Cannot use \`${values.caller}\` with a URL that does not resolve to a route within the app. Use \`window.location = "${values.url}"\` instead`,
			navigation_route_missing
		);
	throwCode('navigation_route_missing');
}
export function redirect_loop(values: Url): never {
	if (DEV)
		throwDiagnostic(
			'redirect_loop',
			`Redirect loop while navigating to \`${values.url}\``,
			redirect_loop
		);
	throwCode('redirect_loop');
}
export function reserved_query_parameter(values: Key): never {
	if (DEV)
		throwDiagnostic(
			'reserved_query_parameter',
			`Cannot use reserved query parameter \`${values.key}\``,
			reserved_query_parameter
		);
	throwCode('reserved_query_parameter');
}
export function scroll_handling_outside_navigation(): never {
	if (DEV)
		throwDiagnostic(
			'scroll_handling_outside_navigation',
			'Can only disable scroll handling during navigation',
			scroll_handling_outside_navigation
		);
	throwCode('scroll_handling_outside_navigation');
}
export function preload_invalid_route_id(values: Route): never {
	if (DEV)
		throwDiagnostic(
			'preload_invalid_route_id',
			`\`preloadCode\` expects a route ID starting with \`/\`, but received \`${values.id}\``,
			preload_invalid_route_id
		);
	throwCode('preload_invalid_route_id');
}
export function preload_url_outside_app(values: Url): never {
	if (DEV)
		throwDiagnostic(
			'preload_url_outside_app',
			`Attempted to preload a URL that does not belong to this app: \`${values.url}\``,
			preload_url_outside_app
		);
	throwCode('preload_url_outside_app');
}
export function snapshot_duplicate_id(values: { id: string }): never {
	if (DEV)
		throwDiagnostic(
			'snapshot_duplicate_id',
			`A snapshot with id \`${values.id}\` is already registered. Pass a unique \`id\`.`,
			snapshot_duplicate_id
		);
	throwCode('snapshot_duplicate_id');
}
export function snapshot_id_missing(): never {
	if (DEV)
		throwDiagnostic(
			'snapshot_id_missing',
			'Could not generate a snapshot id from the stack trace. Pass an `id` instead.',
			snapshot_id_missing
		);
	throwCode('snapshot_id_missing');
}
export function enhance_invalid_method(): never {
	if (DEV)
		throwDiagnostic(
			'enhance_invalid_method',
			'`use:enhance` can only be used on `<form>` elements with `method="POST"`',
			enhance_invalid_method
		);
	throwCode('enhance_invalid_method');
}
export function remote_form_multiple_elements(): never {
	if (DEV)
		throwDiagnostic(
			'remote_form_multiple_elements',
			'A remote form instance can only be attached to one form element',
			remote_form_multiple_elements
		);
	throwCode('remote_form_multiple_elements');
}
export function remote_form_not_attached(): never {
	if (DEV)
		throwDiagnostic(
			'remote_form_not_attached',
			'The remote form must be attached to a form element before submitting',
			remote_form_not_attached
		);
	throwCode('remote_form_not_attached');
}
export function remote_form_reserved_field(): never {
	if (DEV)
		throwDiagnostic(
			'remote_form_reserved_field',
			'Remote form field names cannot begin with $',
			remote_form_reserved_field
		);
	throwCode('remote_form_reserved_field');
}
export function remote_form_mixed_inputs(): never {
	if (DEV)
		throwDiagnostic(
			'remote_form_mixed_inputs',
			'All inputs of an array field must have the same type',
			remote_form_mixed_inputs
		);
	throwCode('remote_form_mixed_inputs');
}
export function remote_form_multiple_files(): never {
	if (DEV)
		throwDiagnostic(
			'remote_form_multiple_files',
			'Use file multiple for an input with multiple files',
			remote_form_multiple_files
		);
	throwCode('remote_form_multiple_files');
}
export function enhance_file_without_enctype(): never {
	if (DEV)
		throwDiagnostic(
			'enhance_file_without_enctype',
			'Your form contains `<input type="file">` fields, but is missing the necessary `enctype="multipart/form-data"` attribute',
			enhance_file_without_enctype
		);
	throwCode('enhance_file_without_enctype');
}
