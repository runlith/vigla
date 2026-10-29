export const open = '<!--[-->';

export const close = '<!--]-->';

export const fallback = -1;

export function arm(index: number): string {
	return `<!--[${index}-->`;
}
