import type { Notice, Reporter, Values } from 'vigla/internal/server';

interface Projection {
	readonly code: string;
	readonly message: (values: Values) => string;
}

const projections: Readonly<Record<string, Projection>> = {
	boundary_reset_noop: {
		code: 'svelte_boundary_reset_noop',
		message: () =>
			'A `<svelte:boundary>` `reset` function only resets the boundary the first time it is called'
	},
	boundary_reset_onerror: {
		code: 'svelte_boundary_reset_onerror',
		message: () =>
			'A `<svelte:boundary>` `reset` function cannot be called while an error is still being handled'
	},
	dynamic_element_invalid_tag: {
		code: 'dynamic_element_invalid_tag',
		message: ({ tag }) =>
			`\`<svelte:element this="${tag}">\` is not a valid element name — the element will not be rendered`
	},
	source_invalid: {
		code: 'store_invalid_shape',
		message: ({ name }) => `\`${name}\` is not a store with a \`subscribe\` method`
	}
};

const explained = new Set([
	'async_local_storage_unavailable',
	'await_invalid',
	'dynamic_element_invalid_tag',
	'html_deprecated',
	'hydratable_clobbering',
	'hydratable_serialization_failed',
	'invalid_csp',
	'invalid_id_prefix',
	'lifecycle_function_unavailable',
	'server_context_required'
]);

const entries = /\/svelte\/src\/entries\//;

function link(code: string): string {
	return `https://svelte.dev/e/${code}`;
}

function project({ code, message, values, dev }: Notice): [string, string | null] {
	const found = projections[code];
	const shown = found === undefined ? code : found.code;
	if (!dev && !explained.has(shown)) return [shown, null];
	return [shown, found === undefined ? message : found.message(values)];
}

export const reporter: Reporter = {
	warn(notice) {
		const [code, message] = project(notice);
		if (message === null) console.warn(link(code));
		else {
			console.warn(
				`%c[svelte] ${code}\n%c${message}\n${link(code)}`,
				'font-weight: bold',
				'font-weight: normal'
			);
		}
	},
	error(notice) {
		const [code, message] = project(notice);
		const error = new Error(message === null ? link(code) : `${code}\n${message}\n${link(code)}`);
		error.name = 'Svelte error';
		return error;
	},
	formatFrame(frame) {
		if (entries.test(frame.replaceAll('\\', '/'))) return null;
		return frame.replace(/\bReactive(Map|Set|Date|URLSearchParams|URL)\./g, 'Svelte$1.');
	}
};
