import type { Diagnostic } from 'vigla/compiler';
import { warning, type Args, type At } from '../diagnostics.ts';

export class Report {
	readonly warnings: Diagnostic[] = [];
	readonly #stack: ReadonlySet<string>[] = [];
	readonly #snapshots = new Map<object, ReadonlySet<string> | undefined>();

	push(codes: readonly string[]): void {
		const inherited = this.#stack.at(-1);
		this.#stack.push(new Set([...(inherited ?? []), ...codes]));
	}

	pop(): void {
		this.#stack.pop();
	}

	mark(node: object): void {
		this.#snapshots.set(node, this.#stack.at(-1));
	}

	ignored(code: string, at?: object): boolean {
		const codes =
			at !== undefined && this.#snapshots.has(at) ? this.#snapshots.get(at) : this.#stack.at(-1);
		return codes?.has(code) ?? false;
	}

	warn(code: string, at: At & object, args?: Args): void;
	warn(code: string, at: At, args?: Args): void;
	warn(code: string, at: At, args: Args = {}): void {
		if (this.ignored(code, typeof at === 'object' ? at : undefined)) return;
		this.warnings.push(warning(code, at, args));
	}

	add(diagnostics: readonly Diagnostic[]): void {
		this.warnings.push(...diagnostics);
	}
}
