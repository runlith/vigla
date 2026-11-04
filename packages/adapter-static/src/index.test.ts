import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import type { Builder, RouteDefinition } from '@vigla/kit';
import adapter from './index.ts';

function fixture(root: string): Builder {
	const write = (file: string, content: string) => {
		mkdirSync(path.dirname(file), { recursive: true });
		writeFileSync(file, content);
	};
	const logger = Object.assign(() => {}, {
		error() {},
		warn() {},
		info() {},
		minor() {},
		success() {},
		err() {},
		prettyError() {}
	});
	return {
		log: logger,
		config: {
			router: { type: 'pathname' },
			files: { routes: root + '/routes' }
		} as unknown as Builder['config'],
		routes: [{ id: '/dynamic', prerender: false } as RouteDefinition],
		manifest: {} as Builder['manifest'],
		identity: { name: 'vigla' } as Builder['identity'],
		mimeTypes: {},
		prerendered: {
			pages: new Map([['/page/', { file: 'page/index.html' }]]),
			assets: new Map(),
			redirects: new Map([['/old', { status: 307, location: '/page/' }]]),
			paths: ['/page/', '/old']
		},
		rimraf: (directory) => rmSync(directory, { recursive: true, force: true }),
		mkdirp: (directory) => {
			mkdirSync(directory, { recursive: true });
		},
		findServerAssets: () => [],
		getBuildDirectory: (name) => root + '/' + name,
		getClientDirectory: () => root,
		getServerDirectory: () => root,
		getAppPath: () => '_app',
		generateEnvModule() {
			write(root + '/environment.js', 'export const env = {}');
		},
		writeClient(directory) {
			assert(existsSync(root + '/environment.js'));
			write(path.join(directory, 'asset.txt'), 'asset');
			return ['asset.txt'];
		},
		writePrerendered(directory) {
			write(path.join(directory, 'page/index.html'), 'page');
			return ['page/index.html'];
		},
		async generateFallback(destination) {
			write(destination, 'fallback');
		},
		async compress(directory) {
			const file = existsSync(path.join(directory, 'asset.txt')) ? 'asset.txt' : 'page/index.html';
			const content = readFileSync(path.join(directory, file));
			writeFileSync(path.join(directory, file + '.gz'), gzipSync(content));
			writeFileSync(path.join(directory, file + '.br'), brotliCompressSync(content));
			return [file];
		},
		writeServer: () => [],
		generateServerInstance() {},
		copy: () => [],
		hasServerInstrumentationFile: () => false,
		createInstrumentationInitializer: () => '',
		instrument() {}
	};
}

test('static output rejects lost dynamic routes and writes a fallback with separately compressed assets', async () => {
	const root = mkdtempSync(path.join(os.tmpdir(), 'adapter-static-'));
	try {
		const builder = fixture(root);
		await assert.rejects(
			Promise.resolve(adapter({ pages: root + '/pages' }).adapt(builder)),
			/Encountered dynamic routes/
		);
		assert(!existsSync(root + '/pages'));
		await adapter({
			pages: root + '/pages',
			assets: root + '/assets',
			fallback: '200.html',
			precompress: true
		}).adapt(builder);
		assert.equal(readFileSync(root + '/pages/200.html', 'utf8'), 'fallback');
		assert.equal(readFileSync(root + '/pages/page/index.html', 'utf8'), 'page');
		assert.equal(readFileSync(root + '/assets/asset.txt', 'utf8'), 'asset');
		assert(existsSync(root + '/pages/page/index.html.br'));
		assert(existsSync(root + '/assets/asset.txt.gz'));
		await adapter({ pages: root + '/non-strict', strict: false }).adapt(builder);
		builder.config.router.type = 'hash';
		await adapter({ pages: root + '/hash' }).adapt(builder);
		assert.equal(readFileSync(root + '/hash/asset.txt', 'utf8'), 'asset');
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('detected Vercel output preserves canonical routes and terminates missing immutable assets', async () => {
	const root = mkdtempSync(path.join(os.tmpdir(), 'adapter-static-platform-'));
	const cwd = process.cwd();
	const previous = process.env.VERCEL;
	process.env.VERCEL = '1';
	process.chdir(root);
	try {
		const builder = fixture(root);
		builder.routes = [];
		await adapter().adapt(builder);
		assert.equal(readFileSync('.vercel/output/static/page/index.html', 'utf8'), 'page');
		const config = JSON.parse(readFileSync('.vercel/output/config.json', 'utf8'));
		assert.deepEqual(config.overrides, { 'page/index.html': { path: 'page' } });
		assert.deepEqual(config.routes.slice(0, 3), [
			{ src: '/old/?', status: 307, headers: { Location: '/page/' } },
			{ src: '/page/', dest: '/page' },
			{ src: '/page', status: 308, headers: { Location: '/page/' } }
		]);
		assert.deepEqual(config.routes.at(-1), {
			src: '/_app/immutable/.+',
			status: 404,
			headers: { 'cache-control': 'no-store' },
			continue: false
		});
		rmSync('.vercel', { recursive: true, force: true });
		await adapter({ pages: 'explicit' }).adapt(builder);
		assert(!existsSync('.vercel/output/config.json'));
		assert.equal(readFileSync('explicit/asset.txt', 'utf8'), 'asset');
	} finally {
		process.chdir(cwd);
		if (previous === undefined) delete process.env.VERCEL;
		else process.env.VERCEL = previous;
		rmSync(root, { recursive: true, force: true });
	}
});
