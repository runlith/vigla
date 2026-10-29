import { CompileError, type Diagnostic } from 'dromon/compiler';
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
