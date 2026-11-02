let collecting: unknown[] | null = null;

export function collected(): unknown[] | null {
	return collecting;
}

export function swapCollector(next: unknown[] | null): unknown[] | null {
	const previous = collecting;
	collecting = next;
	return previous;
}

export function collect<T>(into: unknown[], fn: () => T): T {
	const previous = swapCollector(into);
	try {
		return fn();
	} finally {
		swapCollector(previous);
	}
}
