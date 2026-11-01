import { throwDiagnostic } from '../../shared/diagnostics.ts';

export function invalidValidator(): never {
	return throwDiagnostic(
		'remote_invalid_validator',
		"Invalid validator passed to remote function. Expected `'unchecked'` or a Standard Schema (https://standardschema.dev)",
		invalidValidator
	);
}
export function headersForbidden(): never {
	return throwDiagnostic(
		'remote_headers_forbidden',
		'`setHeaders` is not allowed in remote functions',
		headersForbidden
	);
}
export function cookieForbidden(operation: string): never {
	return throwDiagnostic(
		'remote_cookie_forbidden',
		`Cannot ${operation} cookies in \`query\` or \`prerender\` functions`,
		cookieForbidden
	);
}
export function cookiePath(operation: string): never {
	return throwDiagnostic(
		'remote_cookie_path_relative',
		`Cookies ${operation} in remote functions must have an absolute path`,
		cookiePath
	);
}
export function requestProperty(property: string): never {
	return throwDiagnostic(
		'remote_request_property',
		`Cannot access \`event.${property}\` in a query. Pass the value as an argument to the query instead`,
		requestProperty
	);
}
export function commandMethod(name: string, method: string): never {
	return throwDiagnostic(
		'remote_command_method',
		`Cannot call a command (\`${name}\`) from a \`${method}\` handler`,
		commandMethod
	);
}
export function commandReadonly(name: string): never {
	return throwDiagnostic(
		'remote_command_readonly',
		`Cannot call a command (\`${name}\`) inside a query or prerender function`,
		commandReadonly
	);
}
export function commandRender(name: string): never {
	return throwDiagnostic(
		'remote_command_render',
		`Cannot call a command (\`${name}\`) during server-side rendering`,
		commandRender
	);
}
export function queryPrerender(type: string, name: string): never {
	return throwDiagnostic(
		'remote_query_prerender',
		`Cannot call \`${type}\` \`${name}\` while prerendering, as prerendered pages need static data. Use \`prerender\` from \`$app/server\` instead`,
		queryPrerender
	);
}
export function liveEmpty(name: string): never {
	return throwDiagnostic(
		'remote_query_live_no_value',
		`\`query.live\` \`${name}\` did not yield a value`,
		liveEmpty
	);
}
export function liveInvalid(name: string): never {
	return throwDiagnostic(
		'remote_query_live_not_iterable',
		`\`query.live\` \`${name}\` must return an \`Iterator\`, \`Iterable\`, \`AsyncIterator\` or \`AsyncIterable\``,
		liveInvalid
	);
}
export function formFailure(): never {
	return throwDiagnostic(
		'remote_form_fail',
		'`fail(...)` is for form actions. A remote `form` handler should call `invalid(...)` instead. See https://svelte.dev/docs/kit/remote-functions#form-Programmatic-validation',
		formFailure
	);
}
export function invalidExport(id: string): never {
	return throwDiagnostic(
		'remote_module_invalid_export',
		`\`${id.slice(id.indexOf('/') + 1)}\` exported from \`${id.slice(0, id.indexOf('/'))}\` is invalid — all exports from this file must be remote functions`,
		invalidExport
	);
}
export function defaultExport(id: string): never {
	return throwDiagnostic(
		'remote_module_default_export',
		`Cannot export \`default\` from a remote module (\`${id}\`) — please use named exports instead`,
		defaultExport
	);
}
export function requestedContext(): never {
	return throwDiagnostic(
		'remote_requested_context',
		'`requested(...)` can only be called in the context of a command/form remote function',
		requestedContext
	);
}
export function requestedQuery(): never {
	return throwDiagnostic(
		'remote_requested_invalid_query',
		'`requested(...)` expects a query function created with `query(...)`, `query.batch(...)`, or `query.live(...)`',
		requestedQuery
	);
}
export function requestedLimit(): never {
	return throwDiagnostic(
		'remote_requested_invalid_limit',
		'Limit must be a non-negative integer or `Infinity`',
		requestedLimit
	);
}
export function requestedAsync(name: string, limit: number): never {
	return throwDiagnostic(
		'remote_requested_async_validator',
		`\`requested(${name}, ${limit})\` cannot be used with synchronous iteration because the query validator is async. Use \`for await ... of\` instead`,
		requestedAsync
	);
}
export function requestedMethod(method: string, live: boolean): never {
	return throwDiagnostic(
		'remote_requested_wrong_method',
		`\`${method}()\` is invalid for ${live ? 'live' : 'regular'} queries. Use \`${live ? 'reconnectAll' : 'refreshAll'}()\` instead.`,
		requestedMethod
	);
}
