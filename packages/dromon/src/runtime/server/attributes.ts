import { clsx, toClass, toStyle, type StyleDirectives } from '../../shared/attributes.ts';
import { escapeAttribute } from '../../shared/escape.ts';
import { isBooleanAttribute } from '../../shared/html.ts';

const invalidName =
	/[\s'">/=\u{FDD0}-\u{FDEF}\u{FFFE}\u{FFFF}\u{1FFFE}\u{1FFFF}\u{2FFFE}\u{2FFFF}\u{3FFFE}\u{3FFFF}\u{4FFFE}\u{4FFFF}\u{5FFFE}\u{5FFFF}\u{6FFFE}\u{6FFFF}\u{7FFFE}\u{7FFFF}\u{8FFFE}\u{8FFFF}\u{9FFFE}\u{9FFFF}\u{AFFFE}\u{AFFFF}\u{BFFFE}\u{BFFFF}\u{CFFFE}\u{CFFFF}\u{DFFFE}\u{DFFFF}\u{EFFFE}\u{EFFFF}\u{FFFFE}\u{FFFFF}\u{10FFFE}\u{10FFFF}]/u;

export function attr(name: string, value: unknown, boolean = false): string {
	const flag = boolean || (name === 'hidden' && value !== 'until-found');
	if (value == null || (flag && !value && value !== '')) return '';
	let shown = value;
	if (name === 'translate' && typeof value === 'boolean') shown = value ? 'yes' : 'no';
	return flag ? ` ${name}=""` : ` ${name}="${escapeAttribute(shown)}"`;
}

export function attrClass(
	value: unknown,
	hash?: string | null,
	directives?: Readonly<Record<string, unknown>> | null
): string {
	const result = toClass(value, hash, directives);
	return result ? ` class="${escapeAttribute(result)}"` : '';
}

export function attrStyle(value: unknown, directives?: StyleDirectives | null): string {
	const result = toStyle(value, directives);
	return result ? ` style="${escapeAttribute(result)}"` : '';
}

const NAMESPACED = 1;
const PRESERVE_CASE = 2;
const INPUT = 4;

export function attributes(
	given: Record<string, unknown>,
	hash?: string | null,
	classes?: Readonly<Record<string, unknown>> | null,
	styles?: StyleDirectives | null,
	flags = 0
): string {
	const all = given;
	if (styles) all.style = toStyle(all.style, styles);
	if (all.class) all.class = clsx(all.class);
	if (hash || classes) all.class = toClass(all.class, hash, classes);
	const html = (flags & NAMESPACED) === 0;
	const lowercase = (flags & PRESERVE_CASE) === 0;
	const input = (flags & INPUT) !== 0;
	const names = Object.keys(all);
	let result = '';
	outer: for (const key of names) {
		const value = all[key];
		if (typeof value === 'function') continue;
		if (key.startsWith('$$')) continue;
		if (key === '' || invalidName.test(key)) continue;
		const lower = key.toLowerCase();
		let name = lowercase ? lower : key;
		if (lower.length > 2 && lower.startsWith('on')) continue;
		if (input && (name === 'defaultvalue' || name === 'defaultchecked')) {
			name = name === 'defaultvalue' ? 'value' : 'checked';
			if (name in all) continue;
			for (const other of names) if (other.toLowerCase() === name) continue outer;
		}
		result += attr(name, value, html && isBooleanAttribute(name));
	}
	return result;
}

export { clsx };
