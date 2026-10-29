const voids = new Set([
	'area',
	'base',
	'br',
	'col',
	'command',
	'embed',
	'hr',
	'img',
	'input',
	'keygen',
	'link',
	'meta',
	'param',
	'source',
	'track',
	'wbr'
]);

export function isVoid(name: string): boolean {
	return voids.has(name) || name.toLowerCase() === '!doctype';
}

const reservedWords = new Set([
	'arguments',
	'await',
	'break',
	'case',
	'catch',
	'class',
	'const',
	'continue',
	'debugger',
	'default',
	'delete',
	'do',
	'else',
	'enum',
	'eval',
	'export',
	'extends',
	'false',
	'finally',
	'for',
	'function',
	'if',
	'implements',
	'import',
	'in',
	'instanceof',
	'interface',
	'let',
	'new',
	'null',
	'package',
	'private',
	'protected',
	'public',
	'return',
	'static',
	'super',
	'switch',
	'this',
	'throw',
	'true',
	'try',
	'typeof',
	'var',
	'void',
	'while',
	'with',
	'yield'
]);

export function isReserved(word: string): boolean {
	return reservedWords.has(word);
}

const blockStarters = [
	'address',
	'article',
	'aside',
	'blockquote',
	'div',
	'dl',
	'fieldset',
	'footer',
	'form',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'header',
	'hgroup',
	'hr',
	'main',
	'menu',
	'nav',
	'ol',
	'p',
	'pre',
	'section',
	'table',
	'ul'
];

const closers: Readonly<Record<string, readonly string[]>> = {
	li: ['li'],
	dt: ['dt', 'dd'],
	dd: ['dt', 'dd'],
	p: blockStarters,
	rt: ['rt', 'rp'],
	rp: ['rt', 'rp'],
	optgroup: ['optgroup'],
	option: ['option', 'optgroup'],
	thead: ['tbody', 'tfoot'],
	tbody: ['tbody', 'tfoot'],
	tfoot: ['tbody'],
	tr: ['tr', 'tbody'],
	td: ['td', 'th', 'tr'],
	th: ['td', 'th', 'tr']
};

export function closingTagOmitted(current: string, next?: string): boolean {
	const closing = closers[current];
	return closing !== undefined && (next === undefined || closing.includes(next));
}

export const validTagName =
	/^[a-zA-Z][a-zA-Z0-9]*(-[a-zA-Z0-9.\-_\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u{10000}-\u{EFFFF}]*)?$/u;

export const validComponentName =
	/^(?:\p{Lu}[$\u200C\u200D\p{ID_Continue}.]*|\p{ID_Start}[$\u200C\u200D\p{ID_Continue}]*(?:\.[$\u200C\u200D\p{ID_Continue}]+)+)$/u;

const doctype = /^![a-zA-Z]+$/;
const namespaced = /^[a-zA-Z][a-zA-Z0-9]*:[a-zA-Z][a-zA-Z0-9-]*[a-zA-Z0-9]$/;

export function validElementName(name: string): boolean {
	return doctype.test(name) || namespaced.test(name) || validTagName.test(name);
}

export function isWhitespace(code: number): boolean {
	if (code === 32 || (code <= 13 && code >= 9)) return true;
	if (code < 160) return false;
	return (
		code === 160 ||
		code === 5760 ||
		(code >= 8192 && code <= 8202) ||
		code === 8232 ||
		code === 8233 ||
		code === 8239 ||
		code === 8287 ||
		code === 12288 ||
		code === 65279
	);
}
