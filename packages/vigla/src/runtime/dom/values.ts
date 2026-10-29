export function fallback<T>(value: T | undefined, get: () => T): T {
	return value === undefined ? get() : value;
}

export function toArray<T>(
	value: Iterable<T> | ArrayLike<T> | null | undefined,
	length: number
): T[] {
	if (value == null) return [];
	if (Array.isArray(value)) return value;
	if (Symbol.iterator in Object(value)) {
		const result: T[] = [];
		for (const item of value as Iterable<T>) {
			result.push(item);
			if (result.length === length) break;
		}
		return result;
	}
	return Array.from(value as ArrayLike<T>);
}
