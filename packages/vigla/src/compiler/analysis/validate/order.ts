import type { Diagnostic } from '../../ir/port.ts';

export interface Phased {
	readonly before?: readonly Diagnostic[];
	readonly module?: readonly Diagnostic[];
	readonly instance?: readonly Diagnostic[];
	readonly template?: readonly Diagnostic[];
}

export type Phase = 'module' | 'instance' | 'template';

function merge(own: readonly Diagnostic[], other: readonly Diagnostic[]): Diagnostic[] {
	const merged: Diagnostic[] = [];
	let left = 0;
	let right = 0;
	while (left < own.length && right < other.length) {
		const mine = own[left] as Diagnostic;
		const theirs = other[right] as Diagnostic;
		if (theirs.start < mine.start) {
			merged.push(theirs);
			right++;
		} else {
			merged.push(mine);
			left++;
		}
	}
	return merged.concat(own.slice(left), other.slice(right));
}

export class Order {
	readonly #warnings: Diagnostic[];
	readonly #marks = new Map<Phase, readonly [number, number]>();
	#from = 0;

	constructor(warnings: Diagnostic[]) {
		this.#warnings = warnings;
	}

	phase(phase: Phase, run: () => void): void {
		this.#from = this.#warnings.length;
		run();
		this.#marks.set(phase, [this.#from, this.#warnings.length]);
	}

	result(external: Phased): Diagnostic[] {
		const own = this.#warnings;
		const ordered: Diagnostic[] = [];
		let at = 0;
		const first =
			this.#marks.get('module') ?? this.#marks.get('instance') ?? this.#marks.get('template');
		if (first !== undefined) {
			ordered.push(...own.slice(0, first[0]));
			at = first[0];
		}
		ordered.push(...(external.before ?? []));
		for (const phase of ['module', 'instance', 'template'] as const) {
			const mark = this.#marks.get(phase) ?? [at, at];
			ordered.push(...own.slice(at, mark[0]));
			ordered.push(...merge(own.slice(mark[0], mark[1]), external[phase] ?? []));
			at = mark[1];
		}
		ordered.push(...own.slice(at));
		return ordered;
	}
}
