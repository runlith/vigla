export const OPEN = '[';

export const OPEN_ELSE = '[!';

export const OPEN_FAILED = '[?';

export const CLOSE = ']';

export const open = `<!--${OPEN}-->`;

export const openElse = `<!--${OPEN_ELSE}-->`;

export const close = `<!--${CLOSE}-->`;

export const empty = '<!---->';

export const fallback = -1;

export function arm(index: number): string {
	return `<!--[${index}-->`;
}

export function armIndex(data: string): number {
	return data.charCodeAt(0) === 91 ? Number.parseInt(data.slice(1), 10) : Number.NaN;
}
