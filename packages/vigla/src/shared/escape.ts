const entities: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '"': '&quot;' };

const content = /[&<]/g;
const attribute = /[&<"]/g;
const contentNeeded = /[&<]/;
const attributeNeeded = /[&<"]/;

function entity(char: string): string {
	return entities[char] ?? char;
}

export function escapeContent(value: unknown): string {
	const text = String(value ?? '');
	return contentNeeded.test(text) ? text.replace(content, entity) : text;
}

export function escapeAttribute(value: unknown): string {
	const text = String(value ?? '');
	return attributeNeeded.test(text) ? text.replace(attribute, entity) : text;
}
