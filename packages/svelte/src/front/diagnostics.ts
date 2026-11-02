import { CompileError, errorMessage, warningMessage, type Diagnostic } from 'vigla/compiler';
import { warningCodes as codes, wording } from './wording.ts';

export type At = number | { readonly start?: number | null; readonly end?: number | null };

export type Args = Readonly<Record<string, string | null | undefined>>;

function span(at: At): { start: number; end: number } {
	if (typeof at === 'number') return { start: at, end: at };
	const start = at.start ?? 0;
	return { start, end: at.end ?? start };
}

export function diagnostic(code: string, at: At, args: Args = {}): Diagnostic {
	return { code, message: errorMessage(code, args, wording), ...span(at) };
}

export function fail(code: string, at: At, args: Args = {}): never {
	throw new CompileError(diagnostic(code, at, args));
}

const legacyMessages: Readonly<Record<string, (args: Args) => string>> = {
	component_event_directive_invalid: ({ name }) =>
		`\`on:${name}\` on a component is Svelte 4 event syntax, which is not supported — pass a callback prop such as \`on${name}={...}\` instead`,
	let_directive_invalid: () =>
		'`let:` directives belong to Svelte 4 slots, which are not supported — use snippets instead',
	svelte_fragment_invalid: () =>
		'`<svelte:fragment>` belongs to Svelte 4 slots, which are not supported — use snippets instead',
	slot_attribute_unsupported: () =>
		"The `slot` attribute assigns content to a component's Svelte 4 slot, which is not supported — pass a snippet instead",
	runes_mode_required: () =>
		'Components must use runes mode — `runes: false` and legacy mode are not supported'
};

export function legacy(code: string, at: At, args: Args = {}): never {
	const own = legacyMessages[code];
	const message = own === undefined ? warningMessage(code, args, wording) : own(args);
	throw new CompileError({ code, message, ...span(at) });
}

export function unsupported(what: string, at: At): never {
	throw new CompileError({
		code: 'unsupported',
		message: `${what} is not supported yet`,
		...span(at)
	});
}

export function warning(code: string, at: At, args: Args = {}): Diagnostic {
	return { code, message: warningMessage(code, args, wording), ...span(at) };
}

export const warningCodes: readonly string[] = codes;
