export interface Format {
	readonly global: string;
	readonly meta: string;
	readonly cssWrapper: string;
	readonly htmlPolicy?: string;
}

export const format: Format = {
	global: '__vigla',
	meta: '__vigla_meta',
	cssWrapper: 'vigla-css-wrapper',
	htmlPolicy: 'vigla-html'
};

export function htmlPolicy(given: Format): string {
	return given.htmlPolicy ?? (format.htmlPolicy as string);
}
