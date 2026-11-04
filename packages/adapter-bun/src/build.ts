import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Builder } from '@vigla/kit';
import { rolldown } from 'rolldown';
import type { Options } from './index.ts';
import type { FileAsset } from './static.ts';

export async function build(builder: Builder, options: Options): Promise<void> {
	if (typeof Bun === 'undefined') throw new Error('adapter-bun requires building with Bun');
	const {
		out = 'build',
		precompress = false,
		envPrefix = '',
		serverOptions = {},
		buildOptions = {}
	} = options;
	const embedded = !!buildOptions.compile;
	const stage = embedded ? builder.getBuildDirectory('adapter-bun') : out;
	builder.rimraf(out);
	if (embedded) builder.rimraf(stage);
	mkdirSync(stage, { recursive: true });
	if (embedded && precompress) builder.log.warn('Precompression is ignored for embedded assets');
	const client = builder.writeClient(path.join(stage, 'client'));
	const prerendered = builder.writePrerendered(path.join(stage, 'prerendered'));
	for (const file of [
		...client,
		...prerendered,
		...builder.prerendered.pages.keys(),
		...builder.prerendered.redirects.keys()
	]) {
		if (file.includes('*') || file.split('/').some((segment) => segment.startsWith(':')))
			throw new Error(`Unsupported literal Bun route path: ${JSON.stringify(file)}`);
	}
	if (precompress && !embedded)
		await Promise.all([
			builder.compress(path.join(stage, 'client')),
			builder.compress(path.join(stage, 'prerendered'))
		]);
	const files: FileAsset[] = [];
	const imports = new Map<string, string>();
	const source = (file: string) => {
		if (!embedded) return JSON.stringify(file);
		let name = imports.get(file);
		if (!name) {
			name = `asset${imports.size}`;
			imports.set(file, name);
		}
		return name;
	};
	const measure = async (
		directory: string,
		file: string,
		url: string,
		aliases: string[],
		canonical?: string
	) => {
		const relative = `${directory}/${file}`;
		const physical = path.join(stage, relative);
		const hash = createHash('sha256');
		for await (const chunk of Bun.file(physical).stream()) hash.update(chunk);
		const hidden =
			directory === 'client' &&
			file
				.split('/')
				.some((part, i) => part.startsWith('.') && !(i === 0 && part === '.well-known'));
		files.push({
			source: relative,
			url,
			aliases,
			canonical,
			hidden,
			hash: hash.digest('base64url'),
			mtime: statSync(physical).mtimeMs,
			type: Bun.file(physical).type,
			immutable: directory === 'client' && file.startsWith(builder.config.appDir + '/immutable/'),
			br: !embedded && precompress && existsSync(physical + '.br'),
			gz: !embedded && precompress && existsSync(physical + '.gz')
		});
	};
	const base = builder.config.paths.base;
	for (const file of [...client].sort()) {
		const url = `${base}/${file}`;
		let aliases: string[] = [];
		if (file === 'index.html' || file.endsWith('/index.html')) {
			const directory = url.slice(0, -10);
			aliases = directory === '/' ? ['/'] : [directory, directory.slice(0, -1)];
		} else if (file.endsWith('.html')) aliases = [url.slice(0, -5)];
		await measure('client', file, url, aliases);
	}
	const pageFiles = new Set<string>();
	for (const [url, page] of builder.prerendered.pages) {
		pageFiles.add(page.file);
		await measure('prerendered', page.file, url, [], url);
	}
	for (const file of prerendered)
		if (!pageFiles.has(file)) await measure('prerendered', file, `${base}/${file}`, []);
	const reads = builder.findServerAssets(
		builder.routes.filter((route) => route.prerender !== true)
	);
	for (const file of reads)
		if (!client.includes(file)) throw new Error(`Could not find server asset ${file}`);
	const fileSources = files.map(
		(file) => `{ ...${JSON.stringify(file)}, source: ${source(file.source)} }`
	);
	const readSources = reads.map((file) => `[${JSON.stringify(file)}, ${source('client/' + file)}]`);
	writeFileSync(
		path.join(stage, 'deployment.js'),
		[
			...Array.from(
				imports,
				([file, name]) =>
					`import ${name} from ${JSON.stringify(path.resolve(stage, file))} with { type: 'file' };`
			),
			`export const deployment = { embedded: ${embedded}, envPrefix: ${JSON.stringify(envPrefix)}, origin: ${JSON.stringify(builder.config.paths.origin)}, serverOptions: ${JSON.stringify(serverOptions)}, files: [${fileSources.join(',')}], reads: [${readSources.join(',')}], redirects: ${JSON.stringify([...builder.prerendered.redirects].map(([url, redirect]) => ({ url, ...redirect })))} };`
		].join('\n')
	);
	builder.writeServer(path.join(stage, 'server'));
	builder.generateServerInstance(path.join(stage, 'server/server.js'), {
		serverDirectory: path.join(stage, 'server')
	});
	const bundle = await rolldown({
		input: fileURLToPath(new URL(`./runtime${path.extname(import.meta.url)}`, import.meta.url)),
		platform: 'node',
		external: [/^node:/, 'bun']
	});
	try {
		await bundle.write({ file: path.join(stage, 'runtime.js'), format: 'esm' });
	} finally {
		await bundle.close();
	}
	writeFileSync(path.join(stage, 'package.json'), JSON.stringify({ type: 'module' }));
	writeFileSync(
		path.join(stage, 'handler.js'),
		`import { fileURLToPath } from 'node:url';\nimport { server } from './server/server.js';\nimport { deployment } from './deployment.js';\nimport { createHandler } from './runtime.js';\nexport const app = await createHandler(server, { ...deployment, directory: fileURLToPath(new URL('.', import.meta.url)) });\nexport const handler = app.fetch;\n`
	);
	const entry = path.join(stage, 'index.js');
	writeFileSync(
		entry,
		`import { app } from './handler.js';\nimport { listen } from './runtime.js';\nexport const server = listen(app, ${JSON.stringify(`${builder.identity.name}:shutdown`)});\n`
	);
	if (builder.hasServerInstrumentationFile())
		builder.instrument({
			entrypoint: entry,
			instrumentation: path.join(stage, 'server/instrumentation.server.js'),
			initializer: builder.createInstrumentationInitializer({
				outputDirectory: stage,
				serverDirectory: path.join(stage, 'server')
			}),
			module: { exports: [] }
		});
	if (embedded) {
		const compile = buildOptions.compile;
		const result = await Bun.build({
			...buildOptions,
			sourcemap: buildOptions.sourcemap ?? 'external',
			entrypoints: [path.resolve(entry)],
			target: 'bun',
			format: 'esm',
			conditions: ['bun', 'node'],
			throw: false,
			outdir: out,
			compile: {
				outfile: 'server',
				...(typeof compile === 'string'
					? { target: compile }
					: typeof compile === 'object'
						? compile
						: {})
			}
		});
		if (!result.success) {
			for (const log of result.logs) {
				if (log.level === 'error') builder.log.error(log.message);
				else if (log.level === 'warning') builder.log.warn(log.message);
				else builder.log.info(log.message);
			}
			throw new AggregateError(result.logs, 'Bun executable build failed');
		}
	}
}
