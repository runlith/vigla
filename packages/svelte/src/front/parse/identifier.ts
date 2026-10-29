import * as acorn from 'acorn';

interface Classes {
	isIdentifierStart(code: number, astral: boolean): boolean;
	isIdentifierChar(code: number, astral: boolean): boolean;
}

const classes = acorn as unknown as Classes;

export function identifierStart(code: number): boolean {
	return classes.isIdentifierStart(code, true);
}

export function identifierChar(code: number): boolean {
	return classes.isIdentifierChar(code, true);
}

export function identifierEnd(text: string, start: number): number {
	if (start >= text.length) return -1;
	const code = text.codePointAt(start) as number;
	if (!identifierStart(code)) return -1;
	let end = start + (code <= 0xffff ? 1 : 2);
	while (end < text.length) {
		const next = text.codePointAt(end) as number;
		if (!identifierChar(next)) break;
		end += next <= 0xffff ? 1 : 2;
	}
	return end;
}
