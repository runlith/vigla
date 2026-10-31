import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

export function packageName(root: string): string {
	const require = createRequire(join(root, 'package.json'));
	for (const name of ['@sveltejs/kit', '@vigla/kit']) {
		let file: string;
		try {
			file = require.resolve(`${name}/package.json`);
		} catch {
			continue;
		}
		const manifest: unknown = JSON.parse(readFileSync(file, 'utf8'));
		if (
			manifest &&
			typeof manifest === 'object' &&
			'name' in manifest &&
			(manifest.name === '@vigla/kit' || manifest.name === '@sveltejs/kit')
		)
			return name;
	}
	return '@vigla/kit';
}
