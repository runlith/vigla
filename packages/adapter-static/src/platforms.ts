import { mkdirSync, writeFileSync } from 'node:fs';
import type { Builder } from '@vigla/kit';
import type { Options } from './index.ts';

interface Platform {
	name: string;
	defaults: Options;
	complete(builder: Builder): void;
}

interface OutputRoute {
	src?: string;
	dest?: string;
	status?: number;
	headers?: Record<string, string>;
	handle?: string;
	continue?: boolean;
}

export function detectPlatform(): Platform | undefined {
	return process.env.VERCEL
		? {
				name: 'Vercel',
				defaults: { pages: '.vercel/output/static' },
				complete: writeVercel
			}
		: undefined;
}

function writeVercel(builder: Builder): void {
	const routes: OutputRoute[] = [];
	const overrides: Record<string, { path: string }> = {};
	for (const [source, redirect] of builder.prerendered.redirects) {
		const src =
			source.replace(/\/$/, '') === redirect.location.replace(/\/$/, '')
				? source
				: source.replace(/\/?$/, '/?');
		routes.push({ src, status: redirect.status, headers: { Location: redirect.location } });
	}
	for (const [url, page] of builder.prerendered.pages) {
		let output = url.slice(1);
		if (url !== '/') {
			const alternate = url.endsWith('/') ? url.slice(0, -1) : url + '/';
			if (url.endsWith('/')) output = url.slice(1, -1);
			routes.push(
				{ src: url, dest: alternate },
				{ src: alternate, status: 308, headers: { Location: url } }
			);
		}
		overrides[page.file] = { path: output };
	}
	const immutable = `/${builder.getAppPath()}/immutable/.+`;
	routes.push(
		{ src: immutable, headers: { 'cache-control': 'public, immutable, max-age=31536000' } },
		{ handle: 'filesystem' },
		{ src: immutable, status: 404, headers: { 'cache-control': 'no-store' }, continue: false }
	);
	mkdirSync('.vercel/output', { recursive: true });
	writeFileSync(
		'.vercel/output/config.json',
		JSON.stringify({ version: 3, routes, overrides }, null, 2)
	);
}
