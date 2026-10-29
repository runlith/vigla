const nonWord = /[^\w, ]+/;

function grams(value: string, size: number): Map<string, number> {
	const simplified = `-${value.toLowerCase().replace(nonWord, '')}-`;
	const counts = new Map<string, number>();
	for (let index = 0; index < simplified.length - size + 1; ++index) {
		const gram = simplified.slice(index, index + size);
		counts.set(gram, (counts.get(gram) ?? 0) + 1);
	}
	return counts;
}

function levenshtein(a: string, b: string): number {
	const row: number[] = [];
	let previous = 0;
	for (let i = 0; i <= b.length; i++) {
		for (let j = 0; j <= a.length; j++) {
			let value: number;
			if (i && j) {
				value =
					a.charAt(j - 1) === b.charAt(i - 1)
						? previous
						: Math.min(row[j] as number, row[j - 1] as number, previous) + 1;
			} else {
				value = i + j;
			}
			previous = row[j] as number;
			row[j] = value;
		}
	}
	return row.pop() as number;
}

function similarity(a: string, b: string): number {
	return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

interface Entry {
	readonly norm: number;
	readonly value: string;
}

class Index {
	readonly size: number;
	readonly entries: Entry[] = [];
	readonly postings = new Map<string, [number, number][]>();

	constructor(size: number, values: readonly string[]) {
		this.size = size;
		for (const value of values) {
			const counts = grams(value, size);
			let squares = 0;
			for (const [gram, count] of counts) {
				squares += count * count;
				const list = this.postings.get(gram);
				if (list === undefined) this.postings.set(gram, [[this.entries.length, count]]);
				else list.push([this.entries.length, count]);
			}
			this.entries.push({ norm: Math.sqrt(squares), value });
		}
	}

	best(value: string): [number, string][] {
		const counts = grams(value, this.size);
		const scores = new Map<number, number>();
		let squares = 0;
		for (const [gram, count] of counts) {
			squares += count * count;
			for (const [index, other] of this.postings.get(gram) ?? []) {
				scores.set(index, (scores.get(index) ?? 0) + count * other);
			}
		}
		const norm = Math.sqrt(squares);
		const cosine = [...scores.keys()]
			.sort((a, b) => a - b)
			.map((index): [number, string] => {
				const entry = this.entries[index] as Entry;
				return [(scores.get(index) as number) / (norm * entry.norm), entry.value];
			})
			.sort((a, b) => b[0] - a[0])
			.slice(0, 50)
			.map(([, candidate]): [number, string] => [similarity(candidate, value), candidate])
			.sort((a, b) => b[0] - a[0]);
		return cosine.filter((entry) => entry[0] === cosine[0]?.[0]);
	}
}

export function closest(name: string, names: readonly string[]): string | null {
	if (names.length === 0) return null;
	const normalized = name.toLowerCase();
	const exact = new Map<string, string>();
	const unique: string[] = [];
	for (const candidate of names) {
		const lower = candidate.toLowerCase();
		if (exact.has(lower)) continue;
		exact.set(lower, candidate);
		unique.push(lower);
	}
	const found = exact.get(normalized);
	if (found !== undefined) return found;
	for (const size of [3, 2]) {
		const results = new Index(size, unique).best(normalized);
		if (results.length > 0) {
			const [score, match] = results[0] as [number, string];
			return score > 0.7 ? (exact.get(match) ?? match) : null;
		}
	}
	return null;
}
