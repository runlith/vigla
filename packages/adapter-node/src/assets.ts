import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import type { Builder } from '@vigla/kit';

export interface Asset {
	url: string;
	file: string;
	directory: 'client' | 'prerendered';
	etag: string;
	br: boolean;
	gz: boolean;
	aliases: string[];
	canonical?: string;
}

export async function collectAssets(
	builder: Builder,
	client: string,
	prerendered: string,
	files: string[],
	pages: string[],
	compressed: boolean
): Promise<Asset[]> {
	const base = builder.config.paths.base;
	const assets: Asset[] = [];
	const record = async (
		directory: Asset['directory'],
		root: string,
		file: string,
		url: string,
		aliases: string[] = [],
		canonical?: string
	) => {
		const hash = createHash('sha256');
		for await (const chunk of createReadStream(path.join(root, file))) hash.update(chunk);
		assets.push({
			directory,
			file,
			url,
			aliases,
			canonical,
			etag: hash.digest('base64url'),
			br: compressed && existsSync(path.join(root, file + '.br')),
			gz: compressed && existsSync(path.join(root, file + '.gz'))
		});
	};
	for (const file of [...files].sort()) {
		if (
			file
				.split('/')
				.some((part, i) => part.startsWith('.') && !(i === 0 && part === '.well-known'))
		)
			continue;
		const url = `${base}/${file}`;
		let aliases: string[] = [];
		if (file.endsWith('.html')) {
			const slash =
				file.endsWith('/index.html') || file === 'index.html'
					? url.slice(0, -10)
					: url.slice(0, -5) + '/';
			aliases = slash === '/' ? ['/'] : [slash, slash.slice(0, -1)];
		}
		await record('client', client, file, url, aliases);
	}
	for (const url of builder.prerendered.paths) {
		const page = builder.prerendered.pages.get(url);
		const stripped = url.slice(base.length + 1);
		const candidates = page
			? [page.file]
			: [stripped || 'index.html', stripped + (stripped.endsWith('/') ? 'index.html' : '.html')];
		const file = candidates.find((candidate) => pages.includes(candidate));
		if (file) await record('prerendered', prerendered, file, url, [], url);
	}
	return assets;
}
