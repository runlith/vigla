import { expect, test } from 'vitest';
import type { ServerManifest } from '../types/internal/server.ts';
import { analyse } from './analysis.ts';

test('analysis retains automatic prerender and action metadata for request-time validation', async () => {
	const manifest: ServerManifest = {
		app_dir: '_app',
		app_path: '_app',
		assets: new Set(),
		mime_types: {},
		client: null,
		server_assets: {},
		prerendered_routes: new Set(),
		matchers: async () => ({}),
		remotes: {},
		nodes: [
			async () => ({
				index: 0,
				imports: [],
				stylesheets: [],
				fonts: [],
				universal: { prerender: 'auto' },
				server: { actions: {} }
			})
		],
		routes: [
			{
				id: '/actions',
				pattern: /^\/actions\/?$/,
				params: [],
				page: { layouts: [], errors: [], leaf: 0 },
				endpoint: null
			}
		]
	};
	const metadata = (await analyse(manifest, false)).routes.get('/actions');
	expect(metadata).toMatchObject({
		prerender: 'auto',
		methods: ['GET', 'POST'],
		page: { methods: ['GET', 'POST'] }
	});
});
