import { CompileError } from 'dromon/compiler';

export interface Notice {
	readonly code: string;
	readonly message: string;
}

export type Kind = 'component' | 'module';

const moduleKeys = ['filename', 'rootDir', 'dev', 'generate', 'warningFilter', 'experimental'];

const componentKeys = new Set([
	...moduleKeys,
	'name',
	'runes',
	'css',
	'cssHash',
	'cssOutputFilename',
	'outputFilename',
	'customElement',
	'discloseVersion',
	'namespace',
	'modernAst',
	'preserveComments',
	'preserveWhitespace',
	'fragments',
	'hmr',
	'sourcemap',
	'accessors',
	'immutable',
	'compatibility',
	'legacy',
	'format',
	'tag',
	'sveltePath',
	'errorMode',
	'varsReport',
	'loopGuardTimeout',
	'enableSourcemap',
	'hydratable'
]);

const removed: Readonly<Record<string, string>> = {
	legacy:
		'The legacy option has been removed. If you are using this because of legacy.componentApi, use compatibility.componentApi instead',
	format:
		'The format option has been removed in Svelte 4, the compiler only outputs ESM now. Remove "format" from your compiler options. If you did not set this yourself, bump the version of your bundler plugin (vite-plugin-svelte/rollup-plugin-svelte/svelte-loader)',
	tag: 'The tag option has been removed in Svelte 5. Use `<svelte:options customElement="tag-name" />` inside the component instead. If that does not solve your use case, please open an issue on GitHub with details.',
	sveltePath:
		'The sveltePath option has been removed in Svelte 5. If this option was crucial for you, please open an issue on GitHub with your use case.',
	errorMode:
		'The errorMode option has been removed. If you are using this through svelte-preprocess with TypeScript, use the https://www.typescriptlang.org/tsconfig#verbatimModuleSyntax setting instead',
	varsReport:
		'The vars option has been removed. If you are using this through svelte-preprocess with TypeScript, use the https://www.typescriptlang.org/tsconfig#verbatimModuleSyntax setting instead'
};

const retired: Readonly<Record<string, Notice>> = {
	loopGuardTimeout: {
		code: 'options_removed_loop_guard_timeout',
		message: 'The `loopGuardTimeout` option has been removed'
	},
	enableSourcemap: {
		code: 'options_removed_enable_sourcemap',
		message:
			'The `enableSourcemap` option has been removed. Source maps are always generated now, and tooling can choose to ignore them'
	},
	hydratable: {
		code: 'options_removed_hydratable',
		message: 'The `hydratable` option has been removed. Svelte components are always hydratable now'
	}
};

const deprecated: Readonly<Record<string, Notice>> = {
	accessors: {
		code: 'options_deprecated_accessors',
		message: 'The `accessors` option has been deprecated. It will have no effect in runes mode'
	},
	immutable: {
		code: 'options_deprecated_immutable',
		message: 'The `immutable` option has been deprecated. It will have no effect in runes mode'
	}
};

function fail(code: string, message: string): never {
	throw new CompileError({ code, message, start: 0, end: 0 });
}

function invalid(details: string): never {
	fail('options_invalid_value', `Invalid compiler option: ${details}`);
}

function unbuilt(what: string): never {
	fail('unsupported', `${what} is not supported yet`);
}

function nested(value: unknown, path: string, allowed: readonly string[]): Record<string, unknown> {
	if (value === undefined) return {};
	if (typeof value !== 'object' || value === null) invalid(`${path} should be an object`);
	const record = value as Record<string, unknown>;
	for (const key of Object.keys(record)) {
		if (!allowed.includes(key))
			fail('options_unrecognised', `Unrecognised compiler option ${path}.${key}`);
	}
	return record;
}

export function validate(options: object, kind: Kind): Notice[] {
	const given = options as Record<string, unknown>;
	const keys = kind === 'component' ? componentKeys : new Set(moduleKeys);
	const notices: Notice[] = [];
	for (const key of Object.keys(given)) {
		if (!keys.has(key)) fail('options_unrecognised', `Unrecognised compiler option ${key}`);
		if (given[key] === undefined) continue;
		const message = removed[key];
		if (message !== undefined) fail('options_removed', `Invalid compiler option: ${message}`);
		const notice = deprecated[key];
		if (notice !== undefined) fail(notice.code, notice.message);
		const retirement = retired[key];
		if (retirement !== undefined) notices.push(retirement);
	}
	const experimental = nested(given.experimental, 'experimental', ['async']);
	if (experimental.async === false) invalid('`experimental.async: false` — async is the only mode');
	const compatibility = nested(given.compatibility, 'compatibility', ['componentApi']);
	if (compatibility.componentApi === 4) {
		invalid('`compatibility.componentApi: 4` — the Svelte 4 component API is not supported');
	}
	if (given.runes === false) invalid('`runes: false` — legacy mode is not supported');
	if (typeof given.runes === 'function') unbuilt('A `runes` option given as a function');
	if (given.customElement === true) unbuilt('Custom element output (`customElement: true`)');
	if (
		given.namespace !== undefined &&
		given.namespace !== 'html' &&
		given.namespace !== 'svg' &&
		given.namespace !== 'mathml'
	) {
		invalid('namespace should be one of "html", "mathml" or "svg"');
	}
	if (given.hmr === true) unbuilt('Hot module replacement (`hmr: true`)');
	if (given.fragments === 'tree') unbuilt('`fragments: "tree"`');
	if (given.sourcemap !== undefined) unbuilt('An input source map (`sourcemap`)');
	return notices;
}
