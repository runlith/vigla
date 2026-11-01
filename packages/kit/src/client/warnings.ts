import { warnDiagnostic } from '../shared/diagnostics.ts';

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

export function push_state_deprecated(): void {
	warnDiagnostic('push_state_deprecated', 'Use goto with shallow: true instead of pushState');
}
export function replace_state_deprecated(): void {
	warnDiagnostic(
		'replace_state_deprecated',
		'Use goto with shallow: true and replace: true instead of replaceState'
	);
}
export function window_fetch_in_load(values: { url: string }): void {
	warnDiagnostic(
		'window_fetch_in_load',
		`Use the fetch provided to load instead of window.fetch for ${values.url}`
	);
}
export function goto_replace_state_deprecated(values: { value: string }): void {
	warnDiagnostic(
		'goto_replace_state_deprecated',
		`The replaceState: ${values.value} option is deprecated; use replace instead`
	);
}
export function preload_route_is_pathname(values: Route): void {
	warnDiagnostic(
		'preload_route_is_pathname',
		`\`${values.id}\` is a pathname, not a route ID. Use match to find its route ID.`
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
export function link_option_replaced(values: { name: string }): void {
	warnDiagnostic(
		'link_option_replaced',
		`\`data-sveltekit-${values.name}="true"\` has been replaced with \`data-sveltekit-reset="false"\``
	);
}
export function enhance_invalidate_all_deprecated(): void {
	warnDiagnostic(
		'enhance_invalidate_all_deprecated',
		'The `update({ invalidateAll })` option has been deprecated in favour of `update({ refreshAll })`'
	);
}
