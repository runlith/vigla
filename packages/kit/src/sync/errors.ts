import { throwDiagnostic } from '../shared/diagnostics.ts';

interface RouteId {
	id: string;
}
interface FileName {
	file: string;
}
export function route_escape_uppercase({ id }: RouteId): never {
	return throwDiagnostic(
		'route_escape_uppercase',
		`Character escape sequence in \`${id}\` must be lowercase`,
		route_escape_uppercase
	);
}
export function route_escape_invalid({ id }: RouteId): never {
	return throwDiagnostic(
		'route_escape_invalid',
		`Invalid character escape sequence in \`${id}\``,
		route_escape_invalid
	);
}
export function route_escape_hex_length({ id }: RouteId): never {
	return throwDiagnostic(
		'route_escape_hex_length',
		`Hexadecimal escape sequence in \`${id}\` must be two characters`,
		route_escape_hex_length
	);
}
export function route_escape_unicode_length({ id }: RouteId): never {
	return throwDiagnostic(
		'route_escape_unicode_length',
		`Unicode escape sequence in \`${id}\` must be between four and six characters`,
		route_escape_unicode_length
	);
}
export function route_params_adjacent({ id }: RouteId): never {
	return throwDiagnostic(
		'route_params_adjacent',
		`Invalid route \`${id}\` — parameters must be separated`,
		route_params_adjacent
	);
}
export function route_unbalanced_brackets({ id }: RouteId): never {
	return throwDiagnostic(
		'route_unbalanced_brackets',
		`Invalid route \`${id}\` — brackets are unbalanced`,
		route_unbalanced_brackets
	);
}
export function route_hash_character({ id, suggestion }: RouteId & { suggestion: string }): never {
	return throwDiagnostic(
		'route_hash_character',
		`Route \`${id}\` should be renamed to ${suggestion}`,
		route_hash_character
	);
}
export function route_optional_after_rest({ id }: RouteId): never {
	return throwDiagnostic(
		'route_optional_after_rest',
		`Invalid route \`${id}\` — an \`[[optional]]\` route segment cannot follow a \`[...rest]\` route segment`,
		route_optional_after_rest
	);
}
export function route_optional_rest({ id }: RouteId): never {
	return throwDiagnostic(
		'route_optional_rest',
		`Invalid route \`${id}\` — a rest route segment is always optional, remove the outer square brackets`,
		route_optional_rest
	);
}
export function route_param_invalid({ id, param }: RouteId & { param: string }): never {
	return throwDiagnostic(
		'route_param_invalid',
		`Invalid param: ${param} in route \`${id}\`. Params and matcher names can only have underscores, hyphens, and alphanumeric characters.`,
		route_param_invalid
	);
}
export function route_server_file_hash_router({ file }: FileName): never {
	return throwDiagnostic(
		'route_server_file_hash_router',
		`Cannot use server-only files in an app with \`router.type === 'hash'\`: \`${file}\``,
		route_server_file_hash_router
	);
}
export function route_duplicate_files(values: {
	type: string;
	directory: string;
	existing: string;
	file: string;
}): never {
	return throwDiagnostic(
		'route_duplicate_files',
		`Multiple ${values.type} files found in \`${values.directory}\` : \`${values.existing}\` and \`${values.file}\``,
		route_duplicate_files
	);
}
export function route_conflict({ first, second }: { first: string; second: string }): never {
	return throwDiagnostic(
		'route_conflict',
		`The \`${first}\` and \`${second}\` routes conflict with each other`,
		route_conflict
	);
}
export function route_layout_segment_missing({
	file,
	segment
}: FileName & { segment: string }): never {
	return throwDiagnostic(
		'route_layout_segment_missing',
		`\`${file}\` references missing segment \`${segment}\``,
		route_layout_segment_missing
	);
}
export function routes_not_found(): never {
	return throwDiagnostic(
		'routes_not_found',
		'No routes found. If you are using a custom routes directory, make sure it is specified in your SvelteKit Vite plugin options',
		routes_not_found
	);
}
export function route_prerender_page_and_endpoint({ id, file }: RouteId & FileName): never {
	return throwDiagnostic(
		'route_prerender_page_and_endpoint',
		`Cannot prerender a route (\`${id}\`) with both a page and a \`${file}\``,
		route_prerender_page_and_endpoint
	);
}
export function route_file_reserved({ file }: FileName): never {
	return throwDiagnostic(
		'route_file_reserved',
		`Files prefixed with \`+\` are reserved (saw \`${file}\`)`,
		route_file_reserved
	);
}
export function route_named_layout_in_module({
	file,
	name,
	layout
}: FileName & { name: string; layout: string }): never {
	return throwDiagnostic(
		'route_named_layout_in_module',
		`Only component files can reference named layouts. Remove \`${layout}\` from \`${name}\` (at \`${file}\`)`,
		route_named_layout_in_module
	);
}
export function tsconfig_parse_failed({ file, details }: FileName & { details: string }): never {
	return throwDiagnostic(
		'tsconfig_parse_failed',
		`Could not parse ${file}: ${details}`,
		tsconfig_parse_failed
	);
}
