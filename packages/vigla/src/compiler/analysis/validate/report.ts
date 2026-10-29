import { CompileError, type Diagnostic, type Ignores } from '../../ir/port.ts';
import { errors, warnings } from './messages.ts';

export type At = number | { readonly start?: number | null; readonly end?: number | null } | object;

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
	const located = at as { readonly start?: number | null; readonly end?: number | null };
	const start = located.start ?? 0;
	return { start, end: located.end ?? start };
}

export const warningCodes: readonly string[] = Object.keys(warnings);

export function errorMessage(code: string, args: Args = {}): string {
	return format(errors[code], code, args);
}

export function warningMessage(code: string, args: Args = {}): string {
	return format(warnings[code], code, args);
}

export function fail(code: string, at: At, args: Args = {}): never {
	throw new CompileError({ code, message: errorMessage(code, args), ...span(at) });
}

export class Report {
	readonly warnings: Diagnostic[] = [];
	readonly ignores: Ignores;
	readonly #stack: ReadonlySet<string>[] = [];
	readonly #snapshots = new Map<object, ReadonlySet<string> | undefined>();

	constructor(ignores: Ignores) {
		this.ignores = ignores;
	}

	enter(node: object): boolean {
		const codes = this.ignores.get(node);
		this.#snapshots.set(node, this.#stack.at(-1));
		if (codes === undefined || codes.size === 0) return false;
		const inherited = this.#stack.at(-1);
		const merged = new Set([...(inherited ?? []), ...codes]);
		this.#stack.push(merged);
		this.#snapshots.set(node, merged);
		return true;
	}

	leave(entered: boolean): void {
		if (entered) this.#stack.pop();
	}

	ignored(code: string, at?: object): boolean {
		const codes =
			at !== undefined && this.#snapshots.has(at) ? this.#snapshots.get(at) : this.#stack.at(-1);
		return codes?.has(code) ?? false;
	}

	warn(code: string, at: At, args: Args = {}): void {
		if (this.ignored(code, typeof at === 'object' ? at : undefined)) return;
		this.warnings.push({ code, message: warningMessage(code, args), ...span(at) });
	}
}
