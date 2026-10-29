import type * as ES from 'estree';
import { CompileError, type Diagnostic } from '../../ir/port.ts';

export interface Anchored {
	readonly warnings?: readonly Diagnostic[];
	readonly error?: Diagnostic;
}

export interface Front {
	readonly before?: readonly Diagnostic[];
	readonly at?: ReadonlyMap<object, Anchored>;
}

function merge(own: readonly Diagnostic[], other: readonly Diagnostic[]): Diagnostic[] {
	const merged: Diagnostic[] = [];
	let left = 0;
	let right = 0;
	while (left < own.length && right < other.length) {
		const mine = own[left] as Diagnostic;
		const theirs = other[right] as Diagnostic;
		if (theirs.start <= mine.start) {
			merged.push(theirs);
			right++;
		} else {
			merged.push(mine);
			left++;
		}
	}
	return merged.concat(own.slice(left), other.slice(right));
}

export class Anchors {
	readonly #at: ReadonlyMap<object, Anchored>;
	readonly #warnings: Diagnostic[];
	readonly #emitted = new Set<object>();

	constructor(front: Front, warnings: Diagnostic[]) {
		this.#at = front.at ?? new Map();
		this.#warnings = warnings;
	}

	error(node: object): Diagnostic | undefined {
		return this.#emitted.has(node) ? undefined : this.#at.get(node)?.error;
	}

	emit(node: object, from = this.#warnings.length): void {
		const entry = this.#at.get(node);
		if (entry === undefined || this.#emitted.has(node)) return;
		this.#emitted.add(node);
		if (entry.error !== undefined) throw new CompileError(entry.error);
		const warnings = entry.warnings ?? [];
		if (warnings.length === 0) return;
		const own = this.#warnings.splice(from);
		this.#warnings.push(...merge(own, warnings));
	}

	rest(within: ES.Program | null): void {
		const span =
			within === null
				? null
				: {
						start: (within.body[0] as { start?: number } | undefined)?.start ?? 0,
						end: (within.body.at(-1) as { end?: number } | undefined)?.end ?? 0
					};
		for (const node of this.#at.keys()) {
			if (this.#emitted.has(node)) continue;
			if (span !== null) {
				const located = node as { type?: string; start?: number };
				if (located.type === undefined || located.start === undefined) continue;
				if (located.start < span.start || located.start >= span.end) continue;
			}
			this.emit(node);
		}
	}
}
