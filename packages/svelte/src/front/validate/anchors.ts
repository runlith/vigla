import type { Diagnostic } from 'vigla/compiler';

export const stopped: unique symbol = Symbol('stopped');

export interface Anchor {
	warnings: Diagnostic[];
	error?: Diagnostic;
}

export class Anchors {
	readonly map = new Map<object, Anchor>();
	failed = false;

	#entry(node: object): Anchor {
		let entry = this.map.get(node);
		if (entry === undefined) {
			entry = { warnings: [] };
			this.map.set(node, entry);
		}
		return entry;
	}

	warn(node: object, warnings: readonly Diagnostic[]): void {
		if (warnings.length > 0) this.#entry(node).warnings.push(...warnings);
	}

	fail(node: object, error: Diagnostic): void {
		const entry = this.#entry(node);
		entry.error ??= error;
		this.failed = true;
	}

	translated(
		lowered: ReadonlyMap<object, object>,
		first: ReadonlyMap<object, readonly Diagnostic[]>
	): Map<object, Anchor> {
		const out = new Map<object, Anchor>();
		const entry = (key: object): Anchor => {
			let found = out.get(key);
			if (found === undefined) {
				found = { warnings: [] };
				out.set(key, found);
			}
			return found;
		};
		for (const [node, warnings] of first) entry(node).warnings.push(...warnings);
		for (const [node, anchor] of this.map) {
			const target = entry(lowered.get(node) ?? node);
			target.warnings.push(...anchor.warnings);
			if (anchor.error !== undefined) target.error ??= anchor.error;
		}
		return out;
	}
}
