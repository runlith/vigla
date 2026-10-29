import type { Position } from './ast.ts';

export type Locator = (offset: number) => Position;

export function locator(source: string): Locator {
	const starts = [0];
	for (let index = source.indexOf('\n'); index !== -1; index = source.indexOf('\n', index + 1)) {
		starts.push(index + 1);
	}
	return (offset) => {
		let low = 0;
		let high = starts.length - 1;
		while (low < high) {
			const middle = (low + high + 1) >> 1;
			if ((starts[middle] ?? 0) <= offset) low = middle;
			else high = middle - 1;
		}
		return { line: low + 1, column: offset - (starts[low] ?? 0), character: offset };
	};
}
