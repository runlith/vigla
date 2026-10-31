import { warnDiagnostic } from '../shared/diagnostics.ts';

export function cookie_path_mismatch({
	name,
	pathname,
	paths
}: {
	name: string;
	pathname: string;
	paths: string;
}): void {
	warnDiagnostic(
		'cookie_path_mismatch',
		`\`${name}\` cookie does not exist for \`${pathname}\`, but was previously set at ${paths}. Did you mean to set its \`path\` to \`'/'\` instead?`
	);
}
export function cache_control_empty_directive({ value }: { value: string }): void {
	warnDiagnostic(
		'cache_control_empty_directive',
		`\`cache-control\` header contains empty directives. (While parsing \`${value}\`.)`
	);
}
export function cache_control_invalid_directive({
	directive,
	directives,
	value
}: {
	directive: string;
	directives: string;
	value: string;
}): void {
	warnDiagnostic(
		'cache_control_invalid_directive',
		`Invalid \`cache-control\` directive \`${directive}\`. Did you mean one of: ${directives}? (While parsing \`${value}\`.)`
	);
}
export function content_type_invalid({ type, value }: { type: string; value: string }): void {
	warnDiagnostic(
		'content_type_invalid',
		`Invalid \`content-type\` value \`${type}\`. (While parsing \`${value}\`.)`
	);
}
export function load_tracking_after_return({
	id,
	usage,
	change
}: {
	id: string;
	usage: string;
	change: string;
}): void {
	warnDiagnostic(
		'load_tracking_after_return',
		`\`${id}\`: ${usage} in a promise handler after \`load(...)\` has returned will not cause the function to re-run when ${change}`
	);
}
export function form_action_error_without_ssr(): void {
	warnDiagnostic(
		'form_action_error_without_ssr',
		'The form action returned an error, but the error page was not rendered because SSR is off. Enhance the form to receive its result in CSR.'
	);
}
export function form_action_data_without_ssr(): void {
	warnDiagnostic(
		'form_action_data_without_ssr',
		'The form action returned a value, but it is not available in `page.form` because SSR is off. Enhance the form to receive its result in CSR.'
	);
}
export function transform_page_chunk_comments(): void {
	warnDiagnostic(
		'transform_page_chunk_comments',
		'Removing comments in `transformPageChunk` can break hydration'
	);
}
export function streaming_without_csr(): void {
	warnDiagnostic(
		'streaming_without_csr',
		'Returning promises from server `load` functions will only work if `csr === true`'
	);
}
