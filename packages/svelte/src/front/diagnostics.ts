import { CompileError, type Diagnostic } from 'vigla/compiler';
import { errors, warnings } from './messages.ts';

export type At = number | { readonly start?: number | null; readonly end?: number | null };

export type Args = Readonly<Record<string, string | null | undefined>>;

const placeholder = /%(\w+)%/g;

function format(templates: readonly string[] | undefined, code: string, args: Args): string {
	if (templates === undefined) throw new Error(`Unknown diagnostic code ${code}`);
	let chosen = templates[0] ?? '';
	for (const template of templates) {
		const names = [...template.matchAll(placeholder)].map((match) => match[1] ?? '');
		if (names.every((name) => Boolean(args[name]))) chosen = template;
	}
	return chosen.replace(placeholder, (_, name: string) => args[name] ?? '');
}

function span(at: At): { start: number; end: number } {
	if (typeof at === 'number') return { start: at, end: at };
	const start = at.start ?? 0;
	return { start, end: at.end ?? start };
}

export function diagnostic(code: string, at: At, args: Args = {}): Diagnostic {
	return { code, message: format(errors[code], code, args), ...span(at) };
}

export function fail(code: string, at: At, args: Args = {}): never {
	throw new CompileError(diagnostic(code, at, args));
}

const legacyMessages: Readonly<Record<string, readonly string[]>> = {
	component_event_directive_invalid: [
		'`on:%name%` on a component is Svelte 4 event syntax, which is not supported — pass a callback prop such as `on%name%={...}` instead'
	],
	let_directive_invalid: [
		'`let:` directives belong to Svelte 4 slots, which are not supported — use snippets instead'
	],
	svelte_fragment_invalid: [
		'`<svelte:fragment>` belongs to Svelte 4 slots, which are not supported — use snippets instead'
	],
	slot_attribute_unsupported: [
		"The `slot` attribute assigns content to a component's Svelte 4 slot, which is not supported — pass a snippet instead"
	],
	runes_mode_required: [
		'Components must use runes mode — `runes: false` and legacy mode are not supported'
	]
};

export function legacy(code: string, at: At, args: Args = {}): never {
	const templates = warnings[code] ?? legacyMessages[code];
	throw new CompileError({ code, message: format(templates, code, args), ...span(at) });
}

export function unsupported(what: string, at: At): never {
	throw new CompileError({
		code: 'unsupported',
		message: `${what} is not supported yet`,
		...span(at)
	});
}

export function warning(code: string, at: At, args: Args = {}): Diagnostic {
	return { code, message: format(warnings[code], code, args), ...span(at) };
}

export const warningCodes: readonly string[] = Object.keys(warnings);
