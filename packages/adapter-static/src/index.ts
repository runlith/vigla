import path from 'node:path';
import type { Adapter } from '@vigla/kit';
import { detectPlatform } from './platforms.ts';

export interface Options {
	pages?: string;
	assets?: string;
	fallback?: string;
	precompress?: boolean;
	strict?: boolean;
}

export default function adapter(options?: Options): Adapter {
	return {
		name: '@vigla/adapter-static',
		async adapt(builder) {
			if (
				!options?.fallback &&
				options?.strict !== false &&
				builder.config.router.type !== 'hash'
			) {
				const dynamic = builder.routes.filter((route) => route.prerender !== true);
				if (dynamic.length) {
					const routes = dynamic.map((route) =>
						path.posix.join(path.relative('.', builder.config.files.routes), route.id)
					);
					builder.log.error(`Routes require prerendering or a fallback:\n${routes.join('\n')}`);
					throw new Error('Encountered dynamic routes');
				}
			}
			const platform = detectPlatform();
			if (platform) {
				if (options)
					builder.log.warn(
						`Detected ${platform.name}; explicit options disable zero-config output`
					);
				else builder.log.info(`Detected ${platform.name}, using zero-config output`);
			}
			const {
				pages = 'build',
				assets = pages,
				fallback,
				precompress = false
			} = options ?? platform?.defaults ?? {};
			builder.rimraf(assets);
			if (pages !== assets) builder.rimraf(pages);
			builder.generateEnvModule();
			builder.writeClient(assets);
			builder.writePrerendered(pages);
			if (fallback) await builder.generateFallback(path.join(pages, fallback));
			if (precompress)
				await Promise.all(
					[...new Set([pages, assets])].map((directory) => builder.compress(directory))
				);
			builder.log(
				pages === assets
					? `Wrote site to ${pages}`
					: `Wrote pages to ${pages} and assets to ${assets}`
			);
			if (!options) platform?.complete(builder);
		}
	};
}
