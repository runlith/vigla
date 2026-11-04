import { runtime, throwDiagnostic } from '../shared/diagnostics.ts';
import { identity } from '../shared/identity.ts';

export function request_event_unavailable(): never {
	return throwDiagnostic(
		'request_event_unavailable',
		'Can only read the current request event inside functions invoked during `handle`, such as server `load` functions, actions, endpoints, and other server hooks.',
		request_event_unavailable
	);
}
export function request_event_after_await(): never {
	return throwDiagnostic(
		'request_event_after_await',
		'Can only read the current request event inside functions invoked during `handle`, such as server `load` functions, actions, endpoints, and other server hooks. In environments without `AsyncLocalStorage`, the event must be read synchronously, not after an `await`.',
		request_event_after_await
	);
}
export function request_store_after_await(): never {
	return throwDiagnostic(
		'request_store_after_await',
		'Could not get the request store. In environments without `AsyncLocalStorage`, the request store (used by e.g. remote functions) must be accessed synchronously, not after an `await`. If it was accessed synchronously then this is an internal error.',
		request_store_after_await
	);
}
export function ssr_fetch_relative_url({ url }: { url: string }): never {
	return throwDiagnostic(
		'ssr_fetch_relative_url',
		`Cannot call \`fetch\` eagerly during server-side rendering with relative URL (\`${url}\`) — put your \`fetch\` calls inside \`onMount\` or a \`load\` function instead`,
		ssr_fetch_relative_url
	);
}
export function fetch_response_decoded({ encoding }: { encoding: string }): never {
	return throwDiagnostic(
		'fetch_response_decoded',
		`Cannot return \`fetch(...)\` directly from a handler if the response has a \`Content-Encoding: ${encoding}\` header. The body has already been decoded`,
		fetch_response_decoded
	);
}
export function client_address_unsupported({ adapter }: { adapter: string }): never {
	return throwDiagnostic(
		'client_address_unsupported',
		`\`${adapter}\` does not specify \`getClientAddress\`. Please raise an issue`,
		client_address_unsupported
	);
}
export function set_headers_cookie(): never {
	return throwDiagnostic(
		'set_headers_cookie',
		'Use `event.cookies.set(name, value, options)` instead of `event.setHeaders` to set cookies',
		set_headers_cookie
	);
}
export function header_already_set({ name }: { name: string }): never {
	return throwDiagnostic(
		'header_already_set',
		`\`${name}\` header is already set`,
		header_already_set
	);
}
export function cookies_set_after_response(): never {
	return throwDiagnostic(
		'cookies_set_after_response',
		'Cannot use `cookies.set(...)` after the response has been generated',
		cookies_set_after_response
	);
}
export function set_headers_after_response(): never {
	return throwDiagnostic(
		'set_headers_after_response',
		'Cannot use `setHeaders(...)` after the response has been generated',
		set_headers_after_response
	);
}
export function cookies_serialize_before_route(): never {
	return throwDiagnostic(
		'cookies_serialize_before_route',
		'Cannot serialize cookies until after the route is determined',
		cookies_serialize_before_route
	);
}
export function cookie_too_large({ name }: { name: string }): never {
	return throwDiagnostic(
		'cookie_too_large',
		`Cookie \`${name}\` is too large, and will be discarded by the browser`,
		cookie_too_large
	);
}
export function endpoint_invalid_response({ path }: { path: string }): never {
	return throwDiagnostic(
		'endpoint_invalid_response',
		`Invalid response from route \`${path}\`: handler should return a \`Response\` object`,
		endpoint_invalid_response
	);
}
export function action_throw_fail(): never {
	return throwDiagnostic(
		'action_throw_fail',
		'Cannot `throw fail()`. Use `return fail()`',
		action_throw_fail
	);
}
export function action_default_with_named(): never {
	return throwDiagnostic(
		'action_default_with_named',
		`When using named actions, the default action cannot be used.${runtime.docs('namedActions', (url) => ` See the docs for more info: ${url}`)}`,
		action_default_with_named
	);
}
export function action_name_reserved(): never {
	return throwDiagnostic(
		'action_name_reserved',
		'Cannot use reserved action name `default`',
		action_name_reserved
	);
}
export function action_return_redirect(): never {
	return throwDiagnostic(
		'action_return_redirect',
		'Cannot `return redirect(...)` — use `redirect(...)` instead',
		action_return_redirect
	);
}
export function action_return_error(): never {
	return throwDiagnostic(
		'action_return_error',
		'Cannot `return error(...)` — use `error(...)` or `return fail(...)` instead',
		action_return_error
	);
}
export function action_response_not_serializable({ id }: { id: string }): never {
	return throwDiagnostic(
		'action_response_not_serializable',
		`Data returned from action inside \`${id}\` is not serializable. Form actions need to return plain objects or \`fail()\`. E.g. \`return { success: true }\` or \`return fail(400, { message: "invalid" });\``,
		action_response_not_serializable
	);
}
export function action_data_not_serializable({
	id,
	message,
	path = ''
}: {
	id: string;
	message: string;
	path?: string;
}): never {
	return throwDiagnostic(
		'action_data_not_serializable',
		`Data returned from action inside \`${id}\` is not serializable: ${message}${path ? ` (\`${path}\`)` : ''}`,
		action_data_not_serializable
	);
}
export function load_not_serializable(
	{
		id,
		message,
		path
	}: {
		id: string;
		message: string;
		path: string;
	},
	options?: ErrorOptions
): never {
	try {
		throwDiagnostic(
			'load_not_serializable',
			`Data returned from \`load\` while rendering \`${id}\` is not serializable: ${message} (\`${path}\`). If you need to serialize/deserialize custom types, use transport hooks${runtime.docs('transport', (url) => `: ${url}`)}.`,
			load_not_serializable
		);
	} catch (error) {
		if (error instanceof Error) error.cause = options?.cause;
		throw error;
	}
}
export function load_not_plain_object({ id }: { id: string }): never {
	return throwDiagnostic(
		'load_not_plain_object',
		`Data returned from \`load\` while rendering \`${id}\` is not a plain object`,
		load_not_plain_object
	);
}
export function load_promise_not_serializable(
	{ id }: { id: string },
	options?: ErrorOptions
): never {
	try {
		throwDiagnostic(
			'load_promise_not_serializable',
			`Failed to serialize promise while rendering \`${id}\``,
			load_promise_not_serializable
		);
	} catch (error) {
		if (error instanceof Error) error.cause = options?.cause;
		throw error;
	}
}
export function load_response_header_not_serialized({
	name,
	id
}: {
	name: string;
	id: string;
}): never {
	return throwDiagnostic(
		'load_response_header_not_serialized',
		`Failed to get response header \`${name}\` — it must be included by the \`filterSerializedResponseHeaders\` option${runtime.docs('handle', (url) => `: ${url}`)} (at \`${id}\`)`,
		load_response_header_not_serialized
	);
}
export function load_fetch_cors({ reason }: { reason: string }): never {
	return throwDiagnostic(
		'load_fetch_cors',
		`CORS error: ${reason} \`Access-Control-Allow-Origin\` header is present on the requested resource`,
		load_fetch_cors
	);
}
export function prerender_actions(): never {
	return throwDiagnostic(
		'prerender_actions',
		'Cannot prerender pages with actions',
		prerender_actions
	);
}
export function prerender_endpoint_methods({
	methods,
	id
}: {
	methods: string;
	id: string;
}): never {
	return throwDiagnostic(
		'prerender_endpoint_methods',
		`Cannot prerender a \`+server\` file with ${methods} or fallback handlers (\`${id}\`)`,
		prerender_endpoint_methods
	);
}
export function prerender_endpoint_not_prerenderable({ id }: { id: string }): never {
	return throwDiagnostic(
		'prerender_endpoint_not_prerenderable',
		`\`${id}\` is not prerenderable`,
		prerender_endpoint_not_prerenderable
	);
}
export function prerender_nonce(): never {
	return throwDiagnostic(
		'prerender_nonce',
		"Cannot use prerendering if `config.csp.mode === 'nonce'`",
		prerender_nonce
	);
}
export function prerender_template_nonce({ tag }: { tag: string }): never {
	return throwDiagnostic(
		'prerender_template_nonce',
		`Cannot use prerendering if page template contains \`${tag}\``,
		prerender_template_nonce
	);
}
export function csp_report_only_missing_report(): never {
	return throwDiagnostic(
		'csp_report_only_missing_report',
		'`content-security-policy-report-only` must be specified with either the `report-to` or `report-uri` directives, or both',
		csp_report_only_missing_report
	);
}
export function server_api_unavailable({ name }: { name: string }): never {
	return throwDiagnostic(
		'server_api_unavailable',
		`Cannot call \`${name}\` on the server`,
		server_api_unavailable
	);
}
export function state_read_outside_render({ name }: { name: string }): never {
	return throwDiagnostic(
		'state_read_outside_render',
		`Can only read \`${name}\` on the server during rendering (not in e.g. \`load\` functions), as it is bound to the current request via component context. This prevents state from leaking between users.`,
		state_read_outside_render
	);
}
export function read_implementation_missing(): never {
	return throwDiagnostic(
		'read_implementation_missing',
		'No `read` implementation was provided. Please ensure that your adapter is up to date and supports this feature',
		read_implementation_missing
	);
}
export function read_asset_missing({ file }: { file: string }): never {
	return throwDiagnostic(
		'read_asset_missing',
		`Asset does not exist: \`${file}\``,
		read_asset_missing
	);
}
export function url_search_unavailable_prerender({ property }: { property: string }): never {
	return throwDiagnostic(
		'url_search_unavailable_prerender',
		`Cannot access \`url.${property}\` on a page with prerendering enabled`,
		url_search_unavailable_prerender
	);
}
export function handle_error_hook_failed(options?: ErrorOptions): never {
	try {
		throwDiagnostic(
			'handle_error_hook_failed',
			'The `handleError` hook failed',
			handle_error_hook_failed
		);
	} catch (error) {
		if (error instanceof Error) error.cause = options?.cause;
		throw error;
	}
}
export function tracing_api_missing(): never {
	return throwDiagnostic(
		'tracing_api_missing',
		`Tracing is enabled (see the ${identity.product} plugin \`tracing.server\` option in your \`vite.config.js\`), but \`@opentelemetry/api\` is not available. This error will likely resolve itself when you set up your tracing instrumentation in \`instrumentation.server.js\`.${runtime.docs('observability', (url) => ` For more information, see ${url}`)}`,
		tracing_api_missing
	);
}
