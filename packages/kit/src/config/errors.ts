import type { Diagnostics } from '../shared/diagnostics.ts';

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

export class ConfigErrors {
	private readonly d: Diagnostics;
	constructor(d: Diagnostics) {
		this.d = d;
	}
	config_not_object(): never {
		return this.d.raise(
			'config_not_object',
			`The ${this.d.identity.product} options from the Vite config must be an object`,
			this.config_not_object
		);
	}
	config_expected_object({ keypath }: KeyPath): never {
		return this.d.raise(
			'config_expected_object',
			`\`${keypath}\` should be an object`,
			this.config_expected_object
		);
	}
	config_expected_string({ keypath }: KeyPath): never {
		return this.d.raise(
			'config_expected_string',
			`\`${keypath}\` should be a string, if specified`,
			this.config_expected_string
		);
	}
	config_expected_string_array({ keypath }: KeyPath): never {
		return this.d.raise(
			'config_expected_string_array',
			`\`${keypath}\` should be an array of strings, if specified`,
			this.config_expected_string_array
		);
	}
	config_expected_number({ keypath }: KeyPath): never {
		return this.d.raise(
			'config_expected_number',
			`\`${keypath}\` should be a number, if specified`,
			this.config_expected_number
		);
	}
	config_expected_boolean({ keypath }: KeyPath): never {
		return this.d.raise(
			'config_expected_boolean',
			`\`${keypath}\` should be true or false, if specified`,
			this.config_expected_boolean
		);
	}
	config_expected_function({ keypath }: KeyPath): never {
		return this.d.raise(
			'config_expected_function',
			`\`${keypath}\` should be a function, if specified`,
			this.config_expected_function
		);
	}
	config_expected_positive_integer({ keypath }: KeyPath): never {
		return this.d.raise(
			'config_expected_positive_integer',
			`\`${keypath}\` should be a positive integer, if specified`,
			this.config_expected_positive_integer
		);
	}
	config_expected_one_of({ keypath, options }: KeyPath & { options: string }): never {
		return this.d.raise(
			'config_expected_one_of',
			`\`${keypath}\` should be ${options}`,
			this.config_expected_one_of
		);
	}
	config_unexpected_option({ keypath, suggestion }: Unexpected): never {
		return this.d.raise(
			'config_unexpected_option',
			`Unexpected option \`${keypath}\`${suggestion ? ` (did you mean \`${suggestion}\`?)` : ''}`,
			this.config_unexpected_option
		);
	}
	config_empty_string({ keypath }: KeyPath): never {
		return this.d.raise(
			'config_empty_string',
			`\`${keypath}\` cannot be empty`,
			this.config_empty_string
		);
	}
	config_app_dir_slash({ keypath }: KeyPath): never {
		return this.d.raise(
			'config_app_dir_slash',
			`\`${keypath}\` cannot start or end with '/'`,
			this.config_app_dir_slash
		);
	}
	config_extension_missing_dot({ keypath, extension }: Extension): never {
		return this.d.raise(
			'config_extension_missing_dot',
			`Each member of ${keypath} must start with '.' — saw '${extension}'`,
			this.config_extension_missing_dot
		);
	}
	config_extension_invalid({ extension }: { extension: string }): never {
		return this.d.raise(
			'config_extension_invalid',
			`File extensions must be alphanumeric — saw '${extension}'`,
			this.config_extension_invalid
		);
	}
	config_invalid_adapter({ keypath }: KeyPath): never {
		return this.d.raise(
			'config_invalid_adapter',
			`The ${this.d.identity.product} Vite plugin \`${keypath}\` should be an object with an \`adapt\` method`,
			this.config_invalid_adapter
		);
	}
	config_invalid_prerender_handler({ keypath }: KeyPath): never {
		return this.d.raise(
			'config_invalid_prerender_handler',
			`\`${keypath}\` should be 'fail', 'warn', 'ignore' or a custom function`,
			this.config_invalid_prerender_handler
		);
	}
	config_paths_base_invalid({ keypath }: KeyPath): never {
		return this.d.raise(
			'config_paths_base_invalid',
			`\`${keypath}\` option must either be the empty string or a root-relative path that starts but doesn't end with '/'`,
			this.config_paths_base_invalid
		);
	}
	config_paths_assets_not_absolute({ keypath }: KeyPath): never {
		return this.d.raise(
			'config_paths_assets_not_absolute',
			`\`${keypath}\` option must be an absolute path, if specified`,
			this.config_paths_assets_not_absolute
		);
	}
	config_paths_assets_trailing_slash({ keypath }: KeyPath): never {
		return this.d.raise(
			'config_paths_assets_trailing_slash',
			`\`${keypath}\` option must not end with '/'`,
			this.config_paths_assets_trailing_slash
		);
	}
	config_origin_invalid({ keypath, input }: Origin): never {
		return this.d.raise(
			'config_origin_invalid',
			`\`${keypath}\` must be a valid origin (e.g. 'https://my-site.com'). '${input}' could not be parsed as a URL`,
			this.config_origin_invalid
		);
	}
	config_origin_protocol({ keypath, protocol }: KeyPath & { protocol: string }): never {
		return this.d.raise(
			'config_origin_protocol',
			`\`${keypath}\` must be a valid origin — only 'http' and 'https' protocols are supported, received '${protocol}'`,
			this.config_origin_protocol
		);
	}
	config_origin_has_path({ keypath, input, origin }: Origin & { origin: string }): never {
		return this.d.raise(
			'config_origin_has_path',
			`\`${keypath}\` must be a valid origin — received '${input}' which contains a path, query, or hash. Use the bare origin '${origin}' instead`,
			this.config_origin_has_path
		);
	}
	config_prerender_entry_invalid({ keypath, entry }: KeyPath & { entry: string }): never {
		return this.d.raise(
			'config_prerender_entry_invalid',
			`Each member of \`${keypath}\` must be either '*' or an absolute path beginning with '/' — saw '${entry}'`,
			this.config_prerender_entry_invalid
		);
	}
	config_server_resolution_hash(): never {
		return this.d.raise(
			'config_server_resolution_hash',
			"The `router.resolution` option cannot be 'server' if `router.type` is 'hash'",
			this.config_server_resolution_hash
		);
	}
	config_server_resolution_bundle_strategy(): never {
		return this.d.raise(
			'config_server_resolution_bundle_strategy',
			"The `router.resolution` option cannot be 'server' if `output.bundleStrategy` is 'inline' or 'single'",
			this.config_server_resolution_bundle_strategy
		);
	}
	config_csp_trusted_types_missing(): never {
		return this.d.raise(
			'config_csp_trusted_types_missing',
			`The \`csp.directives['trusted-types']\` option must include '${this.d.identity.name}-trusted-url' when \`serviceWorker.register\` is \`true\``,
			this.config_csp_trusted_types_missing
		);
	}
	app_template_missing({ file }: { file: string }): never {
		return this.d.raise(
			'app_template_missing',
			`${file} does not exist`,
			this.app_template_missing
		);
	}
	app_template_tag_missing({ file, tag }: { file: string; tag: string }): never {
		return this.d.raise(
			'app_template_tag_missing',
			`${file} is missing \`${tag}\``,
			this.app_template_tag_missing
		);
	}
	config_alias_key_invalid({ key }: { key: string }): never {
		return this.d.raise(
			'config_alias_key_invalid',
			`Invalid alias key: \`${key}\``,
			this.config_alias_key_invalid
		);
	}
	config_alias_value_invalid({ value }: { value: string }): never {
		return this.d.raise(
			'config_alias_value_invalid',
			`Invalid alias value: \`${value}\``,
			this.config_alias_value_invalid
		);
	}
}
