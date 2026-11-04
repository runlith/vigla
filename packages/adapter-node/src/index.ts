import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';
import type { Adapter, Builder } from '@vigla/kit';
import { collectAssets } from './assets.ts';

export interface Options {
	out?: string;
	precompress?: boolean;
	envPrefix?: string;
}

export default function adapter(options: Options = {}): Adapter {
	const { out = 'build', precompress = true, envPrefix = '' } = options;
	return {
		name: '@vigla/adapter-node',
		supports: { read: () => true, instrumentation: () => true },
		async adapt(builder: Builder) {
			builder.rimraf(out);
			mkdirSync(out, { recursive: true });
			const base = builder.config.paths.base;
			const client = path.join(out, 'client' + base);
			const prerendered = path.join(out, 'prerendered' + base);
			const files = builder.writeClient(client);
			const pages = builder.writePrerendered(prerendered);
			if (precompress) await Promise.all([builder.compress(client), builder.compress(prerendered)]);
			const assets = await collectAssets(builder, client, prerendered, files, pages, precompress);
			builder.writeServer(path.join(out, 'server'));
			builder.generateServerInstance(path.join(out, 'server/server.js'), {
				serverDirectory: path.join(out, 'server')
			});
			const bundle = await rolldown({
				input: fileURLToPath(new URL(`./runtime${path.extname(import.meta.url)}`, import.meta.url)),
				platform: 'node',
				external: [/^node:/]
			});
			try {
				await bundle.write({ file: path.join(out, 'runtime.js'), format: 'esm' });
			} finally {
				await bundle.close();
			}
			writeFileSync(path.join(out, 'package.json'), JSON.stringify({ type: 'module' }));
			writeFileSync(
				path.join(out, 'deployment.json'),
				JSON.stringify({
					base,
					envPrefix,
					origin: builder.config.paths.origin,
					appPath: builder.getAppPath(),
					mimeTypes: builder.mimeTypes,
					assets
				})
			);
			writeFileSync(
				path.join(out, 'env.js'),
				`import data from './deployment.json' with { type: 'json' };\nimport { Environment } from './runtime.js';\nexport const env = new Environment(process.env, data.envPrefix);\n`
			);
			writeFileSync(
				path.join(out, 'handler.js'),
				`import { fileURLToPath } from 'node:url';\nimport data from './deployment.json' with { type: 'json' };\nimport { server } from './server/server.js';\nimport { createHandler } from './runtime.js';\nimport { env } from './env.js';\nexport const handler = await createHandler(server, { ...data, directory: fileURLToPath(new URL('.', import.meta.url)) }, env);\n`
			);
			writeFileSync(
				path.join(out, 'index.js'),
				`import { listen } from './runtime.js';\nimport { handler } from './handler.js';\nimport { env } from './env.js';\nexport const path = env.get('SOCKET_PATH');\nexport const host = env.get('HOST', '0.0.0.0');\nexport const port = env.get('PORT', '3000');\nexport const server = listen(handler, env, ${JSON.stringify(`${builder.identity.name}:shutdown`)});\n`
			);
			if (builder.hasServerInstrumentationFile()) {
				builder.instrument({
					entrypoint: path.join(out, 'index.js'),
					instrumentation: path.join(out, 'server/instrumentation.server.js'),
					initializer: builder.createInstrumentationInitializer({
						outputDirectory: out,
						serverDirectory: path.join(out, 'server')
					}),
					module: { exports: ['path', 'host', 'port', 'server'] }
				});
			}
		}
	};
}
