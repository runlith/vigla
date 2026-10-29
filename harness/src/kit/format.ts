export function bullet_list(items: readonly string[]): string {
	return items.map((item) => `  - ${item}`).join('\n');
}
