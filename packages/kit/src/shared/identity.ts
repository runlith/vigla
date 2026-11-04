import type { Identity } from '../types/identity.ts';

declare const __VIGLA_IDENTITY__: Identity | undefined;

export const own: Identity = Object.freeze({
	name: 'vigla',
	product: 'Kit',
	plugin: 'kit',
	command: 'vigla-kit',
	outDir: '.vigla',
	assets: '/_vigla_assets',
	announcer: 'vigla-announcer',
	packages: ['@vigla/kit']
});

export const identity: Identity = typeof __VIGLA_IDENTITY__ === 'object' ? __VIGLA_IDENTITY__ : own;
