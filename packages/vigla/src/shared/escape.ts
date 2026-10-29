const entities: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '"': '&quot;' };

const content = /[&<]/g;
const attribute = /[&<"]/g;

function entity(char: string): string {
	return entities[char] ?? char;
}

export function escapeContent(value: unknown): string {
	return String(value ?? '').replace(content, entity);
}

export function escapeAttribute(value: unknown): string {
	return String(value ?? '').replace(attribute, entity);
}
