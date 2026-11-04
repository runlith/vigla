import type { Diagnostics } from '../shared/diagnostics.ts';

interface RouteId {
	id: string;
}
interface FileName {
	file: string;
}
interface EnvCycle {
	type: string;
	importer?: string;
}
interface VariableName {
	name: string;
}
interface ComponentExtension {
	extension: string;
}
function componentName(extension: string): string {
	const name = extension.replace(/^\./, '');
	return name.charAt(0).toUpperCase() + name.slice(1);
}

export class SyncErrors {
	private readonly d: Diagnostics;
	constructor(d: Diagnostics) {
		this.d = d;
	}
	env_invalid_variable_name({ name }: VariableName): never {
		this.d.raise(
			'env_invalid_variable_name',
			`Invalid environment variable name \`${name}\``,
			this.env_invalid_variable_name
		);
	}
	env_variables_missing({ file }: FileName): never {
		this.d.raise(
			'env_variables_missing',
			`\`${file}\` must export a variables object`,
			this.env_variables_missing
		);
	}
	env_app_import(): never {
		this.d.raise(
			'env_app_import',
			'Cannot import `$app/*` modules other than `$app/env` inside `src/env`',
			this.env_app_import
		);
	}
	env_circular_import({ type, importer }: EnvCycle): never {
		this.d.raise(
			'env_circular_import',
			importer
				? `Module \`${importer}\` imports \`$app/env/${type}\`, which creates a circular dependency with \`src/env\``
				: `Cannot import \`$app/env/${type}\` inside \`src/env\` or its dependencies because it creates a circular dependency`,
			this.env_circular_import
		);
	}
	vite_ssr_environment_not_runnable(): never {
		this.d.raise(
			'vite_ssr_environment_not_runnable',
			'The configured Vite SSR environment must be a `RunnableDevEnvironment`',
			this.vite_ssr_environment_not_runnable
		);
	}
	route_escape_uppercase({ id }: RouteId): never {
		return this.d.raise(
			'route_escape_uppercase',
			`Character escape sequence in \`${id}\` must be lowercase`,
			this.route_escape_uppercase
		);
	}
	route_escape_invalid({ id }: RouteId): never {
		return this.d.raise(
			'route_escape_invalid',
			`Invalid character escape sequence in \`${id}\``,
			this.route_escape_invalid
		);
	}
	route_escape_hex_length({ id }: RouteId): never {
		return this.d.raise(
			'route_escape_hex_length',
			`Hexadecimal escape sequence in \`${id}\` must be two characters`,
			this.route_escape_hex_length
		);
	}
	route_escape_unicode_length({ id }: RouteId): never {
		return this.d.raise(
			'route_escape_unicode_length',
			`Unicode escape sequence in \`${id}\` must be between four and six characters`,
			this.route_escape_unicode_length
		);
	}
	route_params_adjacent({ id }: RouteId): never {
		return this.d.raise(
			'route_params_adjacent',
			`Invalid route \`${id}\` — parameters must be separated`,
			this.route_params_adjacent
		);
	}
	route_unbalanced_brackets({ id }: RouteId): never {
		return this.d.raise(
			'route_unbalanced_brackets',
			`Invalid route \`${id}\` — brackets are unbalanced`,
			this.route_unbalanced_brackets
		);
	}
	route_hash_character({ id, suggestion }: RouteId & { suggestion: string }): never {
		return this.d.raise(
			'route_hash_character',
			`Route \`${id}\` should be renamed to ${suggestion}`,
			this.route_hash_character
		);
	}
	route_optional_after_rest({ id }: RouteId): never {
		return this.d.raise(
			'route_optional_after_rest',
			`Invalid route \`${id}\` — an \`[[optional]]\` route segment cannot follow a \`[...rest]\` route segment`,
			this.route_optional_after_rest
		);
	}
	route_optional_rest({ id }: RouteId): never {
		return this.d.raise(
			'route_optional_rest',
			`Invalid route \`${id}\` — a rest route segment is always optional, remove the outer square brackets`,
			this.route_optional_rest
		);
	}
	route_param_invalid({ id, param }: RouteId & { param: string }): never {
		return this.d.raise(
			'route_param_invalid',
			`Invalid param: ${param} in route \`${id}\`. Params and matcher names can only have underscores, hyphens, and alphanumeric characters.`,
			this.route_param_invalid
		);
	}
	route_server_file_hash_router({ file }: FileName): never {
		return this.d.raise(
			'route_server_file_hash_router',
			`Cannot use server-only files in an app with \`router.type === 'hash'\`: \`${file}\``,
			this.route_server_file_hash_router
		);
	}
	route_duplicate_files(values: {
		type: string;
		directory: string;
		existing: string;
		file: string;
	}): never {
		return this.d.raise(
			'route_duplicate_files',
			`Multiple ${values.type} files found in \`${values.directory}\` : \`${values.existing}\` and \`${values.file}\``,
			this.route_duplicate_files
		);
	}
	route_conflict({ first, second }: { first: string; second: string }): never {
		return this.d.raise(
			'route_conflict',
			`The \`${first}\` and \`${second}\` routes conflict with each other`,
			this.route_conflict
		);
	}
	route_layout_segment_missing({ file, segment }: FileName & { segment: string }): never {
		return this.d.raise(
			'route_layout_segment_missing',
			`\`${file}\` references missing segment \`${segment}\``,
			this.route_layout_segment_missing
		);
	}
	routes_not_found(): never {
		return this.d.raise(
			'routes_not_found',
			`No routes found. If you are using a custom \`src/routes\` directory, make sure it is specified in your ${this.d.identity.product} Vite plugin options`,
			this.routes_not_found
		);
	}
	route_prerender_page_and_endpoint({
		id,
		file,
		extension
	}: RouteId & FileName & ComponentExtension): never {
		return this.d.raise(
			'route_prerender_page_and_endpoint',
			`Cannot prerender a route (\`${id}\`) with both a \`+page${extension}\` and a \`${file}\``,
			this.route_prerender_page_and_endpoint
		);
	}
	route_file_reserved({ file }: FileName): never {
		return this.d.raise(
			'route_file_reserved',
			`Files prefixed with \`+\` are reserved (saw \`${file}\`)`,
			this.route_file_reserved
		);
	}
	route_named_layout_in_module({
		file,
		name,
		layout,
		extension
	}: FileName & ComponentExtension & { name: string; layout: string }): never {
		return this.d.raise(
			'route_named_layout_in_module',
			`Only ${componentName(extension)} files can reference named layouts. Remove \`${layout}\` from \`${name}\` (at \`${file}\`)`,
			this.route_named_layout_in_module
		);
	}
	tsconfig_parse_failed({ details }: { details?: string }): never {
		return this.d.raise(
			'tsconfig_parse_failed',
			details === undefined
				? 'Failed to parse TypeScript config'
				: `Failed to parse TypeScript config: ${details}`,
			this.tsconfig_parse_failed
		);
	}
}
