import { warnDiagnostic } from '../shared/diagnostics.ts';
import { identity } from '../shared/identity.ts';

interface Route {
	id: string;
}
interface Link {
	name: string;
	options: string;
}
interface Preload {
	path: string;
	message: string;
}

export function window_fetch_in_load(values: { url: string }): void {
	warnDiagnostic(
		'window_fetch_in_load',
		`Use the fetch provided to load instead of window.fetch for ${values.url}`
	);
}
export function preload_route_is_pathname(values: Route): void {
	warnDiagnostic(
		'preload_route_is_pathname',
		`\`${values.id}\` is a pathname, not a route ID. Use match to find its route ID.`
	);
}
export function preload_code_endpoint_only(values: Route): void {
	warnDiagnostic(
		'preload_code_endpoint_only',
		`\`${values.id}\` has no \`+page\`, so there is no code to preload. If you meant to warm up an endpoint, request it with \`fetch\` instead.`
	);
}
export function preload_route_missing(values: Route): void {
	warnDiagnostic('preload_route_missing', `\`${values.id}\` did not match any route`);
}
export function preload_data_failed(values: Preload): void {
	warnDiagnostic(
		'preload_data_failed',
		`Preloading data for \`${values.path}\` failed with the following error: ${values.message}`
	);
}
export function link_option_invalid(values: Link): void {
	warnDiagnostic(
		'link_option_invalid',
		`Unexpected value for \`${values.name}\` — should be one of ${values.options}`
	);
}
export function link_option_replaced(values: { name: string; replacement: string }): void {
	warnDiagnostic(
		'link_option_replaced',
		`\`data-${identity.name}-${values.name}="true"\` has been replaced with \`data-${identity.name}-${values.replacement}\``
	);
}
