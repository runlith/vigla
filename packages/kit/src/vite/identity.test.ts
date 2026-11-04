import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { vigla } from '@vigla/vite-plugin';
import { afterAll, expect, test } from 'vitest';
import type { ViteDevServer } from 'vite';
import { createKit } from './index.ts';
import { importVite } from '../config/file.ts';
import { packageDirectory } from './paths.ts';
import { own } from '../shared/identity.ts';

let root: string | undefined;
let server: ViteDevServer | undefined;

afterAll(async () => {
	await server?.close();
	if (root) rmSync(root, { recursive: true, force: true });
});

test('an app composed by createKit renders and answers under the identity it was created with', async () => {
	root = realpathSync(mkdtempSync(path.join(tmpdir(), 'kit-identity-')));
	const write = (file: string, content: string) => {
		const destination = path.join(root!, file);
		mkdirSync(path.dirname(destination), { recursive: true });
		writeFileSync(destination, content);
	};
	write('package.json', '{"name":"identity-fixture","type":"module"}');
	mkdirSync(path.join(root, 'node_modules/@vigla'), { recursive: true });
	symlinkSync(packageDirectory, path.join(root, 'node_modules/@vigla/kit'), 'dir');
	const require = createRequire(path.join(packageDirectory, 'package.json'));
	symlinkSync(
		path.dirname(require.resolve('vite/package.json')),
		path.join(root, 'node_modules/vite'),
		'dir'
	);
	write('src/app.html', '<html><head>%other.head%</head><body>%other.body%</body></html>');
	write(
		'src/routes/+page.view.js',
		'export default function Page(output) { output.push("<p>rendered</p>"); }'
	);
	const plugin = createKit({ ...own, name: 'other', outDir: '.other' }, vigla);
	const vite = await importVite(root);
	server = await vite.createServer({
		root,
		configFile: false,
		logLevel: 'silent',
		plugins: await plugin({ extensions: ['.view.js'] }),
		server: { port: 0 },
		optimizeDeps: { noDiscovery: true, include: [] }
	});
	await server.listen();
	const address = server.httpServer!.address();
	if (!address || typeof address === 'string') throw new Error('Expected a TCP address');
	const response = await fetch(`http://localhost:${address.port}/`);
	const html = await response.text();
	expect(response.status, html).toBe(200);
	expect(response.headers.get('x-other-page')).toBe('true');
	expect(response.headers.has('x-vigla-page')).toBe(false);
	expect(html).toContain('<p>rendered</p>');
	expect(html).not.toContain('%other.');
	expect(existsSync(path.join(root, '.other'))).toBe(true);
	expect(existsSync(path.join(root, '.vigla'))).toBe(false);
}, 30_000);
