import * as e from './errors.ts';
import * as w from './warnings.ts';

type Validator = (input: unknown, keypath: string) => any;
type Schema = Record<string, Validator>;

function fallback(value: unknown, parse: Validator): Validator {
	return (input, path) => (input === undefined ? structuredClone(value) : parse(input, path));
}
function object(schema: Schema, open = false): Validator {
	return (input, keypath) => {
		if (input != null && (typeof input !== 'object' || Array.isArray(input)))
			e.config_expected_object({ keypath });
		const source = (input ?? {}) as Record<string, unknown>;
		const output: Record<string, unknown> = {};
		for (const key of Object.keys(source)) {
			if (Object.hasOwn(schema, key)) continue;
			if (!open) e.config_unexpected_option({ keypath: `${keypath}.${key}` });
			if (source[key] !== undefined) output[key] = source[key];
		}
		for (const [key, parse] of Object.entries(schema))
			output[key] = parse(source[key], `${keypath}.${key}`);
		return output;
	};
}
function string(value: string | undefined = undefined): Validator {
	return fallback(value, (input, keypath) => {
		if (typeof input !== 'string') e.config_expected_string({ keypath });
		return input;
	});
}
function strings(value?: string[]): Validator {
	return fallback(value, (input, keypath) => {
		if (!Array.isArray(input) || input.some((item) => typeof item !== 'string'))
			e.config_expected_string_array({ keypath });
		return [...input];
	});
}
function bool(value: boolean): Validator {
	return fallback(value, (input, keypath) => {
		if (typeof input !== 'boolean') e.config_expected_boolean({ keypath });
		return input;
	});
}
function number(value: number): Validator {
	return fallback(value, (input, keypath) => {
		if (typeof input !== 'number') e.config_expected_number({ keypath });
		return input;
	});
}
function choice(values: string[]): Validator {
	return fallback(values[0], (input, keypath) => {
		if (!values.includes(input as string))
			e.config_expected_one_of({
				keypath,
				options: `${values.length > 2 ? 'one of' : 'either'} ${values.map((v) => `"${v}"`).join(' or ')}`
			});
		return input;
	});
}
function removed(
	raise: (values: { keypath: string }) => never = e.config_option_removed
): Validator {
	return (input, keypath) => {
		if (input !== undefined) raise({ keypath });
	};
}
function deprecated(parse: Validator, warn: (values: { keypath: string }) => void): Validator {
	return (input, keypath) => {
		if (input !== undefined) warn({ keypath });
		return parse(input, keypath);
	};
}
const passthrough: Validator = (input) => input;
const directives: Schema = Object.fromEntries(
	[
		'child-src',
		'default-src',
		'frame-src',
		'worker-src',
		'connect-src',
		'font-src',
		'img-src',
		'manifest-src',
		'media-src',
		'object-src',
		'prefetch-src',
		'script-src',
		'script-src-elem',
		'script-src-attr',
		'style-src',
		'style-src-elem',
		'style-src-attr',
		'base-uri',
		'sandbox',
		'form-action',
		'frame-ancestors',
		'navigate-to',
		'report-uri',
		'report-to',
		'require-trusted-types-for',
		'trusted-types',
		'require-sri-for',
		'plugin-types',
		'referrer'
	].map((key) => [key, strings()])
);
directives['upgrade-insecure-requests'] = bool(false);
directives['block-all-mixed-content'] = bool(false);
const handler = fallback(undefined, (input, keypath) => {
	if (typeof input !== 'function' && !['fail', 'warn', 'ignore'].includes(input as string))
		e.config_invalid_prerender_handler({ keypath });
	return input;
});

export const experimental = {
	tracing: removed(e.config_option_removed_experimental_tracing),
	instrumentation: removed(e.config_option_removed_experimental_instrumentation),
	remoteFunctions: bool(true),
	forkPreloads: bool(false),
	handleRenderingErrors: removed()
};
export const schema: Schema = {
	adapter: fallback(undefined, (input, keypath) => {
		if (
			!input ||
			typeof input !== 'object' ||
			!('adapt' in input) ||
			typeof input.adapt !== 'function'
		)
			e.config_invalid_adapter({ keypath });
		return input;
	}),
	alias: deprecated(
		fallback({}, (input, keypath) => {
			if (!input || typeof input !== 'object' || Array.isArray(input))
				e.config_expected_object({ keypath });
			for (const [key, value] of Object.entries(input)) string()(value, `${keypath}.${key}`);
			return { ...input };
		}),
		w.config_option_deprecated_alias
	),
	appDir: fallback('_app', (input, keypath) => {
		const value = string()(input, keypath) as string;
		if (!value) e.config_empty_string({ keypath });
		if (value.startsWith('/') || value.endsWith('/')) e.config_app_dir_slash({ keypath });
		return value;
	}),
	compilerOptions: passthrough,
	csp: object({
		mode: choice(['auto', 'hash', 'nonce']),
		directives: object(directives),
		reportOnly: object(directives)
	}),
	csrf: object({
		checkOrigin: removed(e.config_option_removed_check_origin),
		trustedOrigins: strings([])
	}),
	embedded: bool(false),
	env: object({ dir: string('') }),
	experimental: object(experimental, true),
	extensions: fallback([], (input, keypath) => {
		const values = strings()(input, keypath) as string[];
		for (const extension of values) {
			if (!extension.startsWith('.')) e.config_extension_missing_dot({ keypath, extension });
			if (!/^(\.[a-z0-9]+)+$/i.test(extension)) e.config_extension_invalid({ extension });
		}
		return values;
	}),
	files: object({
		src: string('src'),
		assets: string('static'),
		hooks: object({ client: string(), server: string(), universal: string() }),
		lib: removed(e.config_option_removed_files_lib),
		params: string(),
		routes: string(),
		serviceWorker: string(),
		appTemplate: string(),
		errorTemplate: string()
	}),
	inlineStyleThreshold: number(0),
	moduleExtensions: strings(['.js', '.ts']),
	kit: (input) => {
		if (input !== undefined)
			e.config_kit_namespace({
				keys: Object.keys(input as object)
					.map((key) => `\`${key}\``)
					.join(', ')
			});
	},
	outDir: string('.svelte-kit'),
	output: object({
		linkHeaderPreload: bool(false),
		preloadStrategy: removed(e.config_option_removed_preload_strategy),
		bundleStrategy: choice(['split', 'single', 'inline'])
	}),
	paths: object({
		base: fallback('', (input, keypath) => {
			const value = string()(input, keypath) as string;
			if (value && (!value.startsWith('/') || value.endsWith('/')))
				e.config_paths_base_invalid({ keypath });
			return value;
		}),
		assets: fallback('', (input, keypath) => {
			const value = string()(input, keypath) as string;
			if (value && !/^[a-z]+:\/\//.test(value)) e.config_paths_assets_not_absolute({ keypath });
			if (value.endsWith('/')) e.config_paths_assets_trailing_slash({ keypath });
			return value;
		}),
		origin: fallback(undefined, (input, keypath) => {
			const value = string()(input, keypath) as string;
			let url: URL;
			try {
				url = new URL(value);
			} catch {
				return e.config_origin_invalid({ keypath, input: value });
			}
			if (url.protocol !== 'http:' && url.protocol !== 'https:')
				e.config_origin_protocol({ keypath, protocol: url.protocol });
			if (value !== url.origin)
				e.config_origin_has_path({ keypath, input: value, origin: url.origin });
			return url.origin;
		}),
		relative: bool(true)
	}),
	preprocess: passthrough,
	prerender: object({
		concurrency: fallback(1, (input, keypath) => {
			if (typeof input !== 'number' || !Number.isInteger(input) || input < 1)
				e.config_expected_positive_integer({ keypath });
			return input;
		}),
		crawl: bool(true),
		entries: fallback(['*'], (input, keypath) => {
			const values = strings()(input, keypath) as string[];
			for (const entry of values)
				if (entry !== '*' && !entry.startsWith('/'))
					e.config_prerender_entry_invalid({ keypath, entry });
			return values;
		}),
		handleHttpError: handler,
		handleMissingId: handler,
		handleEntryGeneratorMismatch: handler,
		handleUnseenRoutes: handler,
		handleInvalidUrl: handler,
		origin: removed(e.config_option_removed_prerender_origin)
	}),
	router: object({ type: choice(['pathname', 'hash']), resolution: choice(['client', 'server']) }),
	serviceWorker: object({
		files: removed(),
		register: bool(true),
		options: (input, keypath) =>
			input === undefined ? undefined : object({}, true)(input, keypath)
	}),
	tracing: object({ server: bool(false) }),
	typescript: deprecated(
		object({
			config: (input, keypath) => {
				if (input === undefined) return (value: unknown) => value;
				if (typeof input !== 'function') e.config_expected_function({ keypath });
				return input;
			}
		}),
		w.config_option_deprecated_typescript
	),
	version: object({
		name: (input, path) => string(Date.now().toString())(input, path),
		pollInterval: number(3_600_000)
	}),
	vitePlugin: removed(e.config_option_removed_vite_plugin)
};

export const parseOptions = object(schema, true);
