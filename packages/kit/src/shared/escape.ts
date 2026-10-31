export function escapeHtml(value: string, attribute = false): string {
	return value.replace(attribute ? /[&"]|\p{Surrogate}/gu : /[&<]|\p{Surrogate}/gu, (character) => {
		if (character === '&') return '&amp;';
		if (character === '"') return '&quot;';
		if (character === '<') return '&lt;';
		return `&#${character.charCodeAt(0)};`;
	});
}

export function escapeJson(value: unknown): string {
	return JSON.stringify(value).replace(
		/[<\u2028\u2029]/g,
		(character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
	);
}

export interface Interpolation {
	placeholder: string;
	replacement: string;
}

export function escapeInterpolation(value: string, replacements: Interpolation[] = []): string {
	let escaped = JSON.stringify(value).slice(1, -1).replace(/[`$]/g, '\\$&');
	for (const { placeholder, replacement } of replacements)
		escaped = escaped.replaceAll(placeholder, replacement);
	return escaped;
}
