import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { expect, onTestFinished, test } from 'vitest';
import { sveltekit } from './vite.ts';

test('SSR refreshes root layout CSS after edits without a connected HMR client', async () => {
	const repository = fileURLToPath(new URL('../../../', import.meta.url));
	mkdirSync(path.join(repository, '.work'), { recursive: true });
	const root = mkdtempSync(path.join(repository, '.work/dev-css-'));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	const write = (file: string, content: string) => {
		const destination = path.join(root, file);
		mkdirSync(path.dirname(destination), { recursive: true });
		writeFileSync(destination, content);
	};
	write(
		'package.json',
		JSON.stringify({
			type: 'module',
			dependencies: {
				'@sveltejs/kit': 'workspace:@vigla/sveltekit@*',
				svelte: 'workspace:@vigla/svelte@*'
			}
		})
	);
	mkdirSync(path.join(root, 'node_modules/@sveltejs'), { recursive: true });
	symlinkSync(
		path.join(repository, 'packages/sveltekit'),
		path.join(root, 'node_modules/@sveltejs/kit'),
		'dir'
	);
	symlinkSync(
		path.join(repository, 'packages/svelte'),
		path.join(root, 'node_modules/svelte'),
		'dir'
	);
	symlinkSync(
		path.join(repository, 'packages/sveltekit/node_modules/vite'),
		path.join(root, 'node_modules/vite'),
		'dir'
	);
	write('src/app.html', '<html><head>%sveltekit.head%</head><body>%sveltekit.body%</body></html>');
	write('src/routes/+layout.js', 'export const csr = false; export const prerender = true;');
	const layout = (margin: string, title: string) =>
		`<script>let { children } = $props();</script><h1>${title}</h1><main>{@render children()}</main><footer>footer</footer><style>footer { margin-top: ${margin}; }</style>`;
	write('src/routes/+layout.svelte', layout('6rem', 'initial'));
	write('src/routes/+page.svelte', '<p>home</p>');
	write('src/routes/about/+page.svelte', '<p>about</p>');
	const server = await createServer({
		root,
		configFile: false,
		logLevel: 'silent',
		plugins: await sveltekit(),
		server: { port: 0 },
		optimizeDeps: { noDiscovery: true, include: [] }
	});
	onTestFinished(() => server.close());
	await server.listen();
	const address = server.httpServer!.address();
	if (!address || typeof address === 'string') throw new Error('Expected a TCP address');
	const origin = `http://localhost:${address.port}`;
	const page = async (route: string) => {
		const response = await fetch(origin + route);
		const html = await response.text();
		expect(response.status, html).toBe(200);
		return html;
	};
	const css = (html: string) => html.match(/<style data-sveltekit[^>]*>([\s\S]*?)<\/style>/)?.[1];
	expect(css(await page('/'))).toMatch(/margin-top:\s*6rem/);
	expect(css(await page('/about'))).toMatch(/margin-top:\s*6rem/);
	write('src/routes/+layout.svelte', layout('6.5rem', 'updated'));
	await expect
		.poll(async () => await page('/'), { timeout: 5_000 })
		.toMatch(/<h1[^>]*>updated<\/h1>/);
	await expect
		.poll(async () => css(await page('/')), { timeout: 5_000 })
		.toMatch(/margin-top:\s*6\.5rem/);
	expect(css(await page('/about'))).toMatch(/margin-top:\s*6\.5rem/);
	write('src/routes/+layout.svelte', layout('7rem', 'updated'));
	await expect
		.poll(async () => css(await page('/')), { timeout: 5_000 })
		.toMatch(/margin-top:\s*7rem/);
	expect(css(await page('/about'))).toMatch(/margin-top:\s*7rem/);
}, 30_000);
