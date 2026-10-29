export function fallback<T>(value: T | undefined, get: () => T): T {
	return value === undefined ? get() : value;
}

export function exclude(
	value: Record<PropertyKey, unknown>,
	keys: readonly PropertyKey[]
): Record<PropertyKey, unknown> {
	const result: Record<PropertyKey, unknown> = {};
	for (const key in value) if (!keys.includes(key)) result[key] = value[key];
	for (const symbol of Object.getOwnPropertySymbols(value)) {
		if (Object.prototype.propertyIsEnumerable.call(value, symbol) && !keys.includes(symbol))
			result[symbol] = value[symbol];
	}
	return result;
}

export function toArray<T>(
	value: Iterable<T> | ArrayLike<T> | null | undefined,
	length?: number
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
