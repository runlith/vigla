export interface Format {
	readonly global: string;
	readonly meta: string;
	readonly cssWrapper: string;
}

export const format: Format = {
	global: '__vigla',
	meta: '__vigla_meta',
	cssWrapper: 'vigla-css-wrapper'
};
