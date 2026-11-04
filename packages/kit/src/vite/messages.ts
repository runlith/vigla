import type { Diagnostics } from '../shared/diagnostics.ts';

interface FileMessage {
	file: string;
}
interface AdapterMessage {
	file: string;
	adapter: string;
}
interface MatcherMessage {
	name: string;
	file?: string;
}
interface ImportMessage {
	module: string;
	chain: string;
}
interface ConfigMessage {
	options: string;
}
interface CorsMessage {
	key: string;
}
interface PluginsMessage {
	plugins: string;
}

export class ViteMessages {
	private readonly d: Diagnostics;
	constructor(d: Diagnostics) {
		this.d = d;
	}
	adapter_instrumentation_unsupported({ file, adapter }: AdapterMessage): never {
		this.d.raise(
			'adapter_instrumentation_unsupported',
			`\`${file}\` is unsupported in \`${adapter}\`.`,
			this.adapter_instrumentation_unsupported
		);
	}
	server_only_import({ module, chain }: ImportMessage): never {
		this.d.raise(
			'server_only_import',
			`Cannot import \`${module}\` into code that runs in the browser, as this could leak sensitive information.\n\n${chain}\n\nIf you're only using the import as a type, change it to \`import type\`.`,
			this.server_only_import
		);
	}
	service_worker_invalid_import({ modules }: { modules: string }): never {
		this.d.raise(
			'service_worker_invalid_import',
			`Cannot import ${modules} into service-worker code.`,
			this.service_worker_invalid_import
		);
	}
	config_feature_disabled({
		feature,
		keypath,
		value
	}: {
		feature: string;
		keypath: string;
		value: string;
	}): never {
		const parts = keypath.split('.');
		const snippet = parts
			.map(
				(part, index) => `${'  '.repeat(index)}${part}: ${index === parts.length - 1 ? value : '{'}`
			)
			.concat(parts.slice(1).map((_, index) => `${'  '.repeat(parts.length - 2 - index)}}`))
			.join('\n');
		this.d.raise(
			'config_feature_disabled',
			`To enable ${feature}, add the following to your ${this.d.identity.product} plugin in \`vite.config.js\`:\n\n${snippet}`,
			this.config_feature_disabled
		);
	}
	config_csp_trusted_html_missing({ policy }: { policy: string }): never {
		this.d.raise(
			'config_csp_trusted_html_missing',
			`The \`csp.directives['trusted-types']\` option must include \`'${policy}'\` unless all pages have \`csr: false\``,
			this.config_csp_trusted_html_missing
		);
	}
	fetch_relative_url({ url }: { url: string }): never {
		this.d.raise(
			'fetch_relative_url',
			`Cannot use relative URL (\`${url}\`) with global \`fetch\` — use \`event.fetch\` instead${this.d.docs('fetch', (link) => `: ${link}`)}`,
			this.fetch_relative_url
		);
	}
	remote_module_invalid_export({ name, file }: { name: string; file: string }): never {
		this.d.raise(
			'remote_module_invalid_export',
			`\`${name}\` exported from \`${file}\` is invalid — all exports from this file must be remote functions`,
			this.remote_module_invalid_export
		);
	}
	adapter_missing(): void {
		this.d.warn(
			'adapter_missing',
			`No adapter specified.${this.d.docs('adapters', (url) => ` See ${url} to learn how to configure your app to run on the platform of your choosing`)}`
		);
	}
	service_worker_assets(): never {
		this.d.raise(
			'service_worker_assets',
			'Cannot use service worker alongside `config.paths.assets`',
			this.service_worker_assets
		);
	}
	preview_build_missing({ dir }: { dir: string }): never {
		this.d.raise(
			'preview_build_missing',
			`Server files not found at \`${dir}\`, did you run \`build\` first?`,
			this.preview_build_missing
		);
	}
	params_export_missing({ file }: FileMessage): never {
		this.d.raise(
			'params_export_missing',
			`\`${file}\` does not export \`params\` from \`defineParams\``,
			this.params_export_missing
		);
	}
	param_matcher_missing({ name, file }: MatcherMessage): never {
		this.d.raise(
			'param_matcher_missing',
			`No matcher found for parameter \`${name}\`${file ? ` in \`${file}\`` : ''}`,
			this.param_matcher_missing
		);
	}
	cors_preflight_continue({ key }: CorsMessage): void {
		this.d.warn(
			'cors_preflight_continue',
			`\`OPTIONS\` request handlers will not work unless \`${key}.preflightContinue\` is set to \`true\``
		);
	}
	transform_index_html_unsupported({ plugins }: PluginsMessage): void {
		this.d.warn(
			'transform_index_html_unsupported',
			`The following plugins may not work correctly because they use the \`transformIndexHtml\` hook which is not supported:\n${plugins}`
		);
	}
	vite_config_overridden({ options }: ConfigMessage): void {
		this.d.warn(
			'vite_config_overridden',
			`The following Vite config options will be overridden by ${this.d.identity.product}:\n${options}`
		);
	}
}
