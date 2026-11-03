import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { expect, test } from './gate.js';

test('server fetch applies init over a Request input', async ({ request }) => {
	const response = await request.get('/fetch');
	expect(await response.text()).toContain('<p id="token">from-init</p>');
});

test('a throwing transformPageChunk is called once', async ({ request }) => {
	await request.get('/probe');
	expect((await request.get('/transform')).status()).toBe(500);
	expect(await (await request.get('/probe')).json()).toEqual({ transform: 1 });
});

test('a leaf redirect while its layout load is pending answers the redirect', async ({
	request
}) => {
	const response = await request.get('/pending/redirect', { maxRedirects: 0 });
	expect(response.status()).toBe(303);
	expect((await request.get('/')).status()).toBe(200);
});

test('a redirect thrown by handle for an undecodable path leaves the server answering', async ({
	request
}) => {
	test.skip(!!process.env.DEV, 'the dev middleware rejects the path before Kit');
	const response = await request.get('/%E0%A4%A', { headers: { 'x-guard': '1' }, maxRedirects: 0 });
	expect(response.status()).toBe(400);
	expect((await request.get('/')).status()).toBe(200);
});

test('a prerendered page resolves its streamed promise under a hashed CSP', async ({ page }) => {
	test.skip(!!process.env.DEV, 'only a build prerenders the page');
	await page.goto('/streamed');
	await expect(page.locator('#late')).toHaveText('late');
});

test('server-rendered stylesheet links request their file with CORS', async ({ request }) => {
	test.skip(!!process.env.DEV, 'dev serves component styles inline');
	const html = await (await request.get('/styled')).text();
	const links = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)].map((match) => match[0]);
	expect(links.length).toBeGreaterThan(0);
	for (const link of links) expect(link).toMatch(/\scrossorigin[\s>]/);
});

test('a cluster worker keeps the live SOCKET_PATH of its siblings', async () => {
	test.skip(!!process.env.DEV, 'needs the adapter-node build');
	const socket = join(tmpdir(), `kit-socket-${process.pid}.sock`);
	rmSync(socket, { force: true });
	const child = spawn(process.execPath, ['test/cluster.js'], {
		env: { ...process.env, SOCKET_PATH: socket, WORKERS: '3' },
		stdio: ['ignore', 'pipe', 'inherit']
	});
	try {
		await new Promise((resolve, reject) => {
			child.stdout.on('data', (chunk) => {
				if (String(chunk).includes('ready')) resolve(undefined);
			});
			child.once('exit', (code) => reject(new Error(`cluster exited with ${code}`)));
		});
		expect(existsSync(socket)).toBe(true);
		const status = await new Promise((resolve, reject) =>
			http
				.get({ socketPath: socket, path: '/' }, (response) => {
					response.resume();
					resolve(response.statusCode);
				})
				.on('error', reject)
		);
		expect(status).toBe(200);
	} finally {
		child.kill();
		rmSync(socket, { force: true });
	}
});
