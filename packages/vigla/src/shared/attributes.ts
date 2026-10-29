import { clsx as merge } from 'clsx';

export type ClassValue = Parameters<typeof merge>[0];

export type Styles = Readonly<Record<string, unknown>>;

export type StyleDirectives = Styles | readonly [Styles | null, Styles | null];

export function clsx(value: unknown): string {
	return typeof value === 'object' ? merge(value as ClassValue) : String(value ?? '');
}

const separators = new Set([0x20, 0x09, 0x0a, 0x0d, 0x0c, 0xa0, 0x0b, 0xfeff]);

function separator(char: string | undefined): boolean {
	return char === undefined || separators.has(char.charCodeAt(0));
}

function without(classes: string, name: string): string {
	let result = classes;
	let at = 0;
	while ((at = result.indexOf(name, at)) >= 0) {
		const end = at + name.length;
		if (separator(at === 0 ? undefined : result[at - 1]) && separator(result[end])) {
			result = result.slice(0, at) + result.slice(end + 1);
		} else {
			at = end;
		}
	}
	return result;
}

export function toClass(
	value: unknown,
	hash?: string | null,
	directives?: Readonly<Record<string, unknown>> | null
): string | null {
	let classes = value == null ? '' : String(value);
	if (hash) classes = classes === '' ? hash : `${classes} ${hash}`;
	if (directives) {
		for (const name of Object.keys(directives)) {
			if (directives[name]) classes = classes === '' ? name : `${classes} ${name}`;
			else if (classes !== '') classes = without(classes, name);
		}
	}
	return classes === '' ? null : classes;
}

function cssName(name: string): string {
	return name.startsWith('--') ? name : name.toLowerCase();
}

function declarations(styles: Styles, important: boolean): string {
	let css = '';
	for (const name of Object.keys(styles)) {
		const value = styles[name];
		if (value != null && value !== '') {
			css += ` ${name}: ${String(value)}${important ? ' !important;' : ';'}`;
		}
	}
	return css;
}

function kept(value: string, reserved: ReadonlySet<string>): string {
	let css = '';
	let quote: string | null = null;
	let depth = 0;
	let comment = false;
	let start = 0;
	let colon = -1;
	const length = value.length;
	for (let index = 0; index < length; index++) {
		const char = value[index];
		if (comment) {
			if (char === '/' && value[index - 1] === '*') comment = false;
		} else if (quote !== null) {
			if (char === quote) quote = null;
		} else if (char === '/' && value[index + 1] === '*') {
			comment = true;
		} else if (char === '"' || char === "'") {
			quote = char;
		} else if (char === '(') {
			depth++;
		} else if (char === ')') {
			depth--;
		}
		if (comment || quote !== null || depth !== 0) continue;
		if (char === ':' && colon === -1) {
			colon = index;
		} else if (char === ';' || index === length - 1) {
			if (colon !== -1 && !reserved.has(cssName(value.slice(start, colon).trim()))) {
				const end = char === ';' ? index : index + 1;
				css += ` ${value.slice(start, end).trim()};`;
			}
			start = index + 1;
			colon = -1;
		}
	}
	return css;
}

export function toStyle(value: unknown, directives?: StyleDirectives | null): string | null {
	if (!directives) return value == null ? null : String(value);
	const [normal, important] = Array.isArray(directives)
		? (directives as readonly [Styles | null, Styles | null])
		: [directives as Styles, null];
	let css = '';
	if (value) {
		const reserved = new Set<string>();
		for (const name of Object.keys(normal ?? {})) reserved.add(cssName(name));
		for (const name of Object.keys(important ?? {})) reserved.add(cssName(name));
		css = kept(
			String(value)
				.replaceAll(/\/\*.*?\*\//g, '')
				.trim(),
			reserved
		);
	}
	if (normal) css += declarations(normal, false);
	if (important) css += declarations(important, true);
	css = css.trim();
	return css === '' ? null : css;
}
