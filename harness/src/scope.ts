import { readFileSync } from 'node:fs';

export type Scope = Readonly<Record<string, readonly string[] | null>>;

const separators = [' (', ' > ', '/'];

export function matches(selector: string, entry: string): boolean {
	if (entry === selector) return true;
	return (
		entry.startsWith(selector) &&
		separators.some((separator) => entry.startsWith(separator, selector.length))
	);
}

let read: Scope | null | undefined;

function scope(): Scope | null {
	if (read === undefined) {
		const file = process.env.DROMON_SCOPE;
		read = file ? (JSON.parse(readFileSync(file, 'utf8')) as Scope) : null;
	}
	return read;
}

export function covers(suite: string): boolean {
	const chosen = scope();
	return chosen === null || suite in chosen;
}

export function selectors(suite: string): readonly string[] | null {
	const chosen = scope();
	return chosen === null ? null : (chosen[suite] ?? null);
}

export function reaches(suite: string, sample: string): boolean {
	if (!covers(suite)) return false;
	const chosen = selectors(suite);
	return (
		chosen === null ||
		chosen.some((selector) => matches(selector, sample) || matches(sample, selector))
	);
}

export function selects(suite: string, entry: string): boolean {
	if (!covers(suite)) return false;
	const chosen = selectors(suite);
	return chosen === null || chosen.some((selector) => matches(selector, entry));
}
