import type { Identity, Links } from '../types/identity.ts';

declare const __VIGLA_IDENTITY__: Identity | undefined;

export const own: Identity = {
	name: 'vigla',
	product: 'Kit',
	plugin: 'kit',
	command: 'vigla-kit',
	outDir: '.vigla',
	assets: '/_vigla_assets',
	announcer: 'vigla-announcer',
	packages: ['@vigla/kit']
};

export let identity: Identity = typeof __VIGLA_IDENTITY__ === 'object' ? __VIGLA_IDENTITY__ : own;

export function adopt(value: Identity): void {
	identity = value;
}

export function diagnosticLink(code: string): string {
	return identity.diagnostics ? identity.diagnostics + code : code;
}

export function documentationLink(link: keyof Links): string {
	const url = identity.links?.[link];
	return url ? ` See ${url}` : '';
}
