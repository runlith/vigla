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
