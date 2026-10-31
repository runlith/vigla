import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { serveFile } from './static.ts';

let directory: string;
let server: Server;
let origin: string;

beforeAll(async () => {
	directory = mkdtempSync(path.join(os.tmpdir(), 'kit-static-'));
	const root = path.join(directory, 'public');
	mkdirSync(root);
	writeFileSync(path.join(root, 'data.txt'), '0123456789');
	writeFileSync(path.join(directory, 'private.txt'), 'private');
	utimesSync(path.join(root, 'data.txt'), new Date('2020-01-01'), new Date('2020-01-01'));
	server = createServer((request, response) => {
		if (
			!serveFile({
				directory: root,
				pathname: new URL(request.url!, 'http://static.local').pathname,
				request,
				response
			})
		) {
			response.writeHead(404);
			response.end('missing');
		}
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('Expected a TCP address');
	origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
	await new Promise<void>((resolve, reject) =>
		server?.close((error) => (error ? reject(error) : resolve()))
	);
	rmSync(directory, { recursive: true, force: true });
});

test('static GET and HEAD share representation metadata without a HEAD body', async () => {
	const response = await fetch(`${origin}/data.txt`);
	expect(await response.text()).toBe('0123456789');
	expect(response.headers.get('content-type')).toBe('text/plain');
	expect(response.headers.get('last-modified')).toBe('Wed, 01 Jan 2020 00:00:00 GMT');
	const head = await fetch(`${origin}/data.txt`, {
		method: 'HEAD',
		headers: { range: 'bytes=0-0' }
	});
	expect(head.status).toBe(200);
	expect(head.headers.get('content-length')).toBe('10');
	expect(head.headers.get('etag')).toBe(response.headers.get('etag'));
	expect(await head.text()).toBe('');
});

test.each([
	['bytes=0-0', 206, '0', 'bytes 0-0/10'],
	['bytes=-3', 206, '789', 'bytes 7-9/10'],
	['bytes=7-', 206, '789', 'bytes 7-9/10'],
	['bytes=10-', 416, '', 'bytes */10']
])('static range %s', async (range, status, body, contentRange) => {
	const response = await fetch(`${origin}/data.txt`, { headers: { range: String(range) } });
	expect(response.status).toBe(status);
	expect(response.headers.get('content-range')).toBe(contentRange);
	expect(await response.text()).toBe(body);
});

test('static validators precede ranges and If-None-Match precedes modification dates', async () => {
	const initial = await fetch(`${origin}/data.txt`);
	await initial.text();
	const etag = initial.headers.get('etag')!;
	const date = initial.headers.get('last-modified')!;
	const matched = await fetch(`${origin}/data.txt`, {
		headers: { 'if-none-match': `"stale", ${etag}`, range: 'bytes=0-0' }
	});
	expect(matched.status).toBe(304);
	const dated = await fetch(`${origin}/data.txt`, { headers: { 'if-modified-since': date } });
	expect(dated.status).toBe(304);
	const stale = await fetch(`${origin}/data.txt`, {
		headers: { 'if-none-match': '"stale"', 'if-modified-since': date }
	});
	expect(stale.status).toBe(200);
	expect(await stale.text()).toBe('0123456789');
});

test('static If-Range requires a strong matching validator', async () => {
	const response = await fetch(`${origin}/data.txt`);
	await response.text();
	const weak = await fetch(`${origin}/data.txt`, {
		headers: { range: 'bytes=0-0', 'if-range': response.headers.get('etag')! }
	});
	expect(weak.status).toBe(200);
	expect(await weak.text()).toBe('0123456789');
	const dated = await fetch(`${origin}/data.txt`, {
		headers: { range: 'bytes=0-0', 'if-range': response.headers.get('last-modified')! }
	});
	expect(dated.status).toBe(206);
	expect(await dated.text()).toBe('0');
});

test('static requests preserve caller fallback for absent, wrong-case and escaping paths', async () => {
	for (const pathname of ['/missing.txt', '/DATA.txt', '/..%2fprivate.txt']) {
		const response = await fetch(origin + pathname);
		expect(response.status).toBe(404);
		expect(await response.text()).toBe('missing');
	}
});
