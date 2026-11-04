import type { Diagnostics } from '../shared/diagnostics.ts';

interface InstrumentationMessage {
	kind: string;
	file: string;
}
interface FileMessage {
	file: string;
}
interface RouteMessage {
	id: string;
}
interface NameMessage {
	name: string;
}
interface HashMessage {
	file: string;
	options: string;
}
interface PrerenderConflict {
	path: string;
	parent?: string;
}
function bulletList(items: string[]): string {
	return items.map((item) => `  - ${item}`).join('\n');
}

export class BuildMessages {
	private readonly d: Diagnostics;
	constructor(d: Diagnostics) {
		this.d = d;
	}
	adapter_instrumentation_file_missing({ kind, file }: InstrumentationMessage): never {
		this.d.raise(
			'adapter_instrumentation_file_missing',
			`${kind} \`${file}\` not found. This is probably a bug in your adapter.`,
			this.adapter_instrumentation_file_missing
		);
	}
	adapter_read_unsupported({ route, adapter }: { route: string; adapter: string }): never {
		this.d.raise(
			'adapter_read_unsupported',
			`Cannot use \`read\` from \`$app/server\` in \`${route}\` when using \`${adapter}\`. Please ensure that your adapter is up to date and supports this feature.`,
			this.adapter_read_unsupported
		);
	}
	adapter_fallback_overwrites({ file }: FileMessage): void {
		this.d.warn(
			'adapter_fallback_overwrites',
			`Overwriting \`${file}\` with fallback page. Consider using a different name for the fallback.`
		);
	}
	router_hash_page_options({ file, options }: HashMessage): never {
		this.d.raise(
			'router_hash_page_options',
			`Page options are ignored when \`router.type === 'hash'\` (\`${file}\` has ${options})`,
			this.router_hash_page_options
		);
	}
	params_export_missing({ file }: FileMessage): never {
		this.d.raise(
			'params_export_missing',
			`\`${file}\` does not export \`params\` from \`defineParams\``,
			this.params_export_missing
		);
	}
	param_matcher_missing({ name, file }: NameMessage & { file?: string }): never {
		this.d.raise(
			'param_matcher_missing',
			`No matcher found for parameter \`${name}\`${file === undefined ? '' : ` in \`${file}\``}`,
			this.param_matcher_missing
		);
	}
	prerender_endpoint_methods({ id, methods }: RouteMessage & { methods: string }): never {
		this.d.raise(
			'prerender_endpoint_methods',
			`Cannot prerender a \`+server\` file with ${methods} or fallback handlers (\`${id}\`)`,
			this.prerender_endpoint_methods
		);
	}
	route_prerender_page_and_endpoint({
		id,
		file,
		extension
	}: RouteMessage & FileMessage & { extension: string }): never {
		this.d.raise(
			'route_prerender_page_and_endpoint',
			`Cannot prerender a route (\`${id}\`) with both a \`+page${extension}\` and a \`${file}\``,
			this.route_prerender_page_and_endpoint
		);
	}
	route_config_mismatch({ id }: RouteMessage): never {
		this.d.raise(
			'route_config_mismatch',
			`Mismatched route config for \`${id}\` — the \`+page\` and \`+server\` files must export the same config, if any`,
			this.route_config_mismatch
		);
	}
	prerender_http_error(
		status: number,
		path: string,
		referrer: string | null,
		referenceType: string,
		base: string
	): string {
		if (status === 404 && !path.startsWith(base))
			return this.d.text(
				'prerender_path_outside_base',
				referrer
					? `\`${path}\` (${referenceType} from \`${referrer}\`) does not begin with \`base\`. You can fix this by using \`resolve('${path}')\` from \`$app/paths\`. The base path is configurable from \`paths.base\``
					: `\`${path}\` does not begin with \`base\`. You can fix this by using \`resolve('${path}')\` from \`$app/paths\`. The base path is configurable from \`paths.base\``
			);
		return this.d.text(
			'prerender_http_error',
			status === 404 && referrer
				? `\`${path}\` was ${referenceType} from \`${referrer}\``
				: `Failed to prerender \`${path}\``
		);
	}
	prerender_invalid_url(href: string, referrer: string | null): string {
		return this.d.text(
			'prerender_invalid_url',
			referrer ? `Invalid URL \`${href}\` (linked from \`${referrer}\`)` : `Invalid URL \`${href}\``
		);
	}
	prerender_directory_conflict({ path, parent }: PrerenderConflict): never {
		this.d.raise(
			'prerender_directory_conflict',
			`Cannot save \`${path}\` as ${parent === undefined ? 'it is already a directory' : `\`${parent}\` is already a file`}.${this.d.docs('prerenderConflicts', (url) => ` See ${url} for more information`)}`,
			this.prerender_directory_conflict
		);
	}
	prerender_missing_id(path: string, id: string, referrers: string[]): string {
		return this.d.text(
			'prerender_missing_id',
			`The following pages contain links to \`${path}#${id}\`, but no element with \`id="${id}"\` exists on \`${path}\`:\n${bulletList(referrers)}`
		);
	}
	prerender_entry_generator_mismatch(id: string, entry: string, matched: string): string {
		return this.d.text(
			'prerender_entry_generator_mismatch',
			`The \`entries\` export from \`${id}\` generated entry \`${entry}\`, which was matched by \`${matched === entry ? 'a static route' : matched}\``
		);
	}
	prerender_unseen_routes(routes: string[]): string {
		return this.d.text(
			'prerender_unseen_routes',
			`The following routes were marked as prerenderable, but were not prerendered because they were not found while crawling your app:\n${bulletList(routes)}`
		);
	}
	prerender_policy_hint(name: string): string {
		const link = this.d.identity.links?.prerender;
		return `To suppress or handle this error, implement \`${name}\` in ${link ?? `the \`prerender\` options of \`${this.d.identity.plugin}(...)\``}`;
	}
	prerender_root_non_html({ base }: { base: string }): never {
		this.d.raise(
			'prerender_root_non_html',
			`Cannot prerender a root \`+server.js\` that returns a non-HTML response — static hosts always serve an HTML file for \`${base}\``,
			this.prerender_root_non_html
		);
	}
	prerender_redirect_location_missing({ path }: { path: string }): void {
		this.d.warn(
			'prerender_redirect_location_missing',
			`\`location\` header missing on redirect received from \`${path}\``
		);
	}
	prerender_client_address(): never {
		this.d.raise(
			'prerender_client_address',
			'Cannot read `clientAddress` during prerendering',
			this.prerender_client_address
		);
	}
	prerender_fallback_failed(): never {
		this.d.raise(
			'prerender_fallback_failed',
			'Could not create a fallback page',
			this.prerender_fallback_failed
		);
	}
}
