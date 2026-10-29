const nonWord = /[^\w, ]+/;

function grams(value: string, size: number): Map<string, number> {
	const padded = `-${value.replace(nonWord, '')}-`;
	const counts = new Map<string, number>();
	for (let start = 0; start + size <= padded.length; start++) {
		const gram = padded.slice(start, start + size);
		counts.set(gram, (counts.get(gram) ?? 0) + 1);
	}
	return counts;
}

function norm(counts: ReadonlyMap<string, number>): number {
	let squares = 0;
	for (const count of counts.values()) squares += count * count;
	return Math.sqrt(squares);
}

function distance(a: string, b: string): number {
	let row = Array.from({ length: a.length + 1 }, (_, index) => index);
	for (let i = 1; i <= b.length; i++) {
		const next = [i];
		for (let j = 1; j <= a.length; j++) {
			const cost = a.charAt(j - 1) === b.charAt(i - 1) ? 0 : 1;
			next[j] = Math.min(
				(row[j] as number) + 1,
				(next[j - 1] as number) + 1,
				(row[j - 1] as number) + cost
			);
		}
		row = next;
	}
	return row[a.length] as number;
}

function similarity(a: string, b: string): number {
	return 1 - distance(a, b) / Math.max(a.length, b.length);
}

interface Ranked {
	readonly index: number;
	readonly score: number;
}

class Grams {
	readonly #values: readonly string[];
	readonly #norms: number[] = [];
	readonly #postings = new Map<string, [number, number][]>();
	readonly #size: number;

	constructor(size: number, values: readonly string[]) {
		this.#size = size;
		this.#values = values;
		for (const value of values) {
			const counts = grams(value, size);
			for (const [gram, count] of counts) {
				const posting: [number, number] = [this.#norms.length, count];
				const list = this.#postings.get(gram);
				if (list === undefined) this.#postings.set(gram, [posting]);
				else list.push(posting);
			}
			this.#norms.push(norm(counts));
		}
	}

	best(value: string): Ranked | null {
		const counts = grams(value, this.#size);
		const dots = new Map<number, number>();
		for (const [gram, count] of counts) {
			for (const [index, other] of this.#postings.get(gram) ?? []) {
				dots.set(index, (dots.get(index) ?? 0) + count * other);
			}
		}
		const length = norm(counts);
		const ranked = [...dots.keys()]
			.sort((a, b) => a - b)
			.map((index) => ({
				index,
				score: (dots.get(index) as number) / (length * (this.#norms[index] as number))
			}))
			.sort((a, b) => b.score - a.score)
			.slice(0, 50)
			.map(({ index }) => ({ index, score: similarity(this.#values[index] as string, value) }))
			.sort((a, b) => b.score - a.score);
		return ranked[0] ?? null;
	}
}

class Candidates {
	readonly original = new Map<string, string>();
	readonly sizes: readonly Grams[];
	readonly values: readonly string[];

	constructor(names: readonly string[]) {
		for (const name of names) {
			const lower = name.toLowerCase();
			if (!this.original.has(lower)) this.original.set(lower, name);
		}
		this.values = [...this.original.keys()];
		this.sizes = [new Grams(3, this.values), new Grams(2, this.values)];
	}
}

const cache = new WeakMap<readonly string[], Candidates>();

export function closest(name: string, names: readonly string[]): string | null {
	if (names.length === 0) return null;
	let candidates = cache.get(names);
	if (candidates === undefined) {
		candidates = new Candidates(names);
		cache.set(names, candidates);
	}
	const value = name.toLowerCase();
	const exact = candidates.original.get(value);
	if (exact) return exact;
	for (const index of candidates.sizes) {
		const best = index.best(value);
		if (best === null) continue;
		if (best.score <= 0.7) return null;
		return candidates.original.get(candidates.values[best.index] as string) ?? null;
	}
	return null;
}
