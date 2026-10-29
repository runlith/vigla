import { fail } from '../diagnostics.ts';

const pairs: Readonly<Record<string, string>> = { '{': '}', '(': ')', '[': ']' };

function unescaped(text: string, from: number, char: string): number {
	for (let index = text.indexOf(char, from); index !== -1; index = text.indexOf(char, index + 1)) {
		let slashes = 0;
		for (let back = index - 1; text[back] === '\\'; back--) slashes++;
		if (slashes % 2 === 0) return index;
	}
	return Infinity;
}

function stringEnd(text: string, from: number, quote: string): number {
	if (quote === '`') return unescaped(text, from, quote);
	const line = text.indexOf('\n', from);
	return unescaped(line === -1 ? text : text.slice(0, line), from, quote);
}

function regexEnd(text: string, from: number): number {
	const slash = unescaped(text, from, '/');
	return slash < unescaped(text, from, '\n') ? slash : Infinity;
}

function after(text: string, needle: string, from: number): number {
	const found = text.indexOf(needle, from);
	return (found === -1 ? Infinity : found) + needle.length;
}

export function findMatchingBracket(text: string, from: number, open: string): number | undefined {
	const close = pairs[open];
	let depth = 1;
	let index = from;
	while (depth > 0 && index < text.length) {
		const char = text[index];
		if (char === "'" || char === '"' || char === '`') {
			index = stringEnd(text, index + 1, char) + 1;
			continue;
		}
		if (char === '/') {
			const next = text[index + 1];
			if (next === undefined || next === '') index++;
			else if (next === '/') index = after(text, '\n', index + 1);
			else if (next === '*') index = after(text, '*/', index + 1);
			else {
				const end = regexEnd(text, index + 1) + 1;
				index = end === Infinity ? index + 1 : end;
			}
			continue;
		}
		if (char === open) depth++;
		else if (char === close) depth--;
		if (depth === 0) return index;
		index++;
	}
	return undefined;
}

export function matchBracket(
	template: string,
	start: number,
	brackets: Readonly<Record<string, string>> = pairs
): number {
	const closers = new Set(Object.values(brackets));
	const stack: string[] = [];
	let index = start;
	while (index < template.length) {
		const char = template[index++] as string;
		if (char === "'" || char === '"' || char === '`') {
			index = matchQuote(template, index, char);
			continue;
		}
		if (char in brackets) {
			stack.push(char);
		} else if (closers.has(char)) {
			const expected = brackets[stack.pop() as string] as string;
			if (char !== expected) fail('expected_token', index - 1, { token: expected });
			if (stack.length === 0) return index;
		}
	}
	fail('unexpected_eof', template.length);
}

function matchQuote(template: string, start: number, quote: string): number {
	let escaped = false;
	let index = start;
	while (index < template.length) {
		const char = template[index++];
		if (escaped) {
			escaped = false;
			continue;
		}
		if (char === quote) return index;
		if (char === '\\') escaped = true;
		if (quote === '`' && char === '$' && template[index] === '{')
			index = matchBracket(template, index);
	}
	fail('unterminated_string_constant', start);
}
