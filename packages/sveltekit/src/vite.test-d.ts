import type { Config } from './vite.ts';

export const upstream: Config = {
	prebundleSvelteLibraries: false,
	experimental: { disableSvelteResolveWarnings: true, remoteFunctions: true }
};

export const native: Config = {
	// @ts-expect-error
	prebundleLibraries: false
};
