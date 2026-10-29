import { entities } from './entities.ts';

const longest = Math.max(...Object.keys(entities).map((name) => name.length));

const windows1252 = [
	8364, 129, 8218, 402, 8222, 8230, 8224, 8225, 710, 8240, 352, 8249, 338, 141, 381, 143, 144, 8216,
	8217, 8220, 8221, 8226, 8211, 8212, 732, 8482, 353, 8250, 339, 157, 382, 376
];

function valid(code: number, attribute: boolean): number {
	if (code === 10 && !attribute) return 32;
	if (code < 128) return code;
	if (code <= 159) return windows1252[code - 128] as number;
	if (code < 55296) return code;
	if (code <= 57343) return 0;
	if (code <= 196607) return code;
	if ((code >= 917504 && code <= 917631) || (code >= 917760 && code <= 917999)) return code;
	return 0;
}

const word = /\w/;

function isHex(char: string | undefined): boolean {
	return char !== undefined && /[0-9a-fA-F]/.test(char);
}

function isDigit(char: string | undefined): boolean {
	return char !== undefined && char >= '0' && char <= '9';
}

interface Reference {
	readonly end: number;
	readonly code: number;
}

function numeric(text: string, at: number): Reference | null {
	let index = at + 1;
	let code: number;
	if ((text[index] === 'x' || text[index] === 'X') && isHex(text[index + 1])) {
		const from = ++index;
		while (isHex(text[index])) index++;
		code = parseInt(text.slice(from, index), 16);
	} else if (isDigit(text[index])) {
		const from = index;
		while (isDigit(text[index])) index++;
		code = parseInt(text.slice(from, index), 10);
	} else {
		return null;
	}
	if (text[index] === ';') index++;
	return { end: index, code };
}

function named(text: string, at: number, attribute: boolean): Reference | null {
	for (let length = Math.min(longest, text.length - at); length > 0; length--) {
		const name = text.slice(at, at + length);
		const code = entities[name];
		if (code === undefined) continue;
		if (attribute && !name.endsWith(';')) {
			const next = text[at + length];
			if (next !== undefined && (word.test(next) || next === '=')) continue;
		}
		return { end: at + length, code };
	}
	return null;
}

export function decode(text: string, attribute: boolean): string {
	let index = text.indexOf('&');
	if (index === -1) return text;
	let out = '';
	let copied = 0;
	while (index !== -1) {
		const at = index + 1;
		const reference = text[at] === '#' ? numeric(text, at) : named(text, at, attribute);
		if (reference === null) {
			index = text.indexOf('&', at);
			continue;
		}
		if (reference.code) {
			out += text.slice(copied, index) + String.fromCodePoint(valid(reference.code, attribute));
			copied = reference.end;
		}
		index = text.indexOf('&', reference.end);
	}
	return out + text.slice(copied);
}
