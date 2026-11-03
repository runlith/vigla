import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sveltekit } from '@sveltejs/kit/vite';
import { expect, test } from 'vitest';
import { createServer } from 'vite';

test('linked workspace stylesheet assets are served in development', async () => {
	const workspace = mkdtempSync(join(process.cwd(), '.workspace-'));
	const app = join(workspace, 'app');
	const linked = join(workspace, 'shared');
	const write = (name, contents) => {
		const file = join(workspace, name);
		mkdirSync(join(file, '..'), { recursive: true });
		writeFileSync(file, contents);
	};
	write('package.json', JSON.stringify({ private: true, workspaces: ['app', 'shared'] }));
	write('app/package.json', JSON.stringify({ type: 'module', dependencies: { '@sveltejs/kit': '*' } }));
	write('app/src/app.html', '<html><head>%sveltekit.head%</head><body>%sveltekit.body%</body></html>');
	write('app/src/routes/+server.js', 'export function GET() { return new Response("page"); }');
	write('app/src/main.js', "import 'linked-asset';");
	write('shared/package.json', JSON.stringify({ name: 'linked-asset', type: 'module', exports: './index.js' }));
	write('shared/index.js', "import './styles.css';");
	write('shared/styles.css', '@font-face { font-family: example; src: url(./font.woff2); }');
	write('shared/font.woff2', 'font bytes');
	write('shared/unrelated.txt', 'not public');
	mkdirSync(join(app, 'node_modules'), { recursive: true });
	symlinkSync(linked, join(app, 'node_modules/linked-asset'), 'dir');
	let server;
	try {
		server = await createServer({
			root: app,
			configFile: false,
			logLevel: 'silent',
			plugins: await sveltekit(),
			server: { host: '127.0.0.1', port: 6450, strictPort: true },
			optimizeDeps: { noDiscovery: true, include: [] }
		});
		await server.listen();
		const origin = 'http://127.0.0.1:6450';
		const entry = await fetch(`${origin}/src/main.js`);
		expect(entry.status).toBe(200);
		expect(await entry.text()).toContain('/shared/index.js');
		const stylesheet = await fetch(`${origin}/@fs/${linked}/styles.css`);
		expect(stylesheet.status).toBe(200);
		expect(await stylesheet.text()).toContain('/shared/font.woff2');
		const asset = await fetch(`${origin}/@fs/${linked}/font.woff2`);
		expect(asset.status).toBe(200);
		expect(await asset.text()).toBe('font bytes');
		await server.close();
		server = await createServer({
			root: app,
			configFile: false,
			logLevel: 'silent',
			plugins: await sveltekit(),
			server: { host: '127.0.0.1', port: 6450, strictPort: true, fs: { allow: [app] } },
			optimizeDeps: { noDiscovery: true, include: [] }
		});
		await server.listen();
		const restricted = await fetch(`${origin}/@fs/${linked}/unrelated.txt`);
		expect(restricted.status).toBe(403);
	} finally {
		await server?.close();
		rmSync(workspace, { recursive: true, force: true });
	}
}, 60_000);
