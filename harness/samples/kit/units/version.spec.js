import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { assert, describe, it } from 'vitest';

describe('@sveltejs/kit VERSION', () => {
	it('should be the exact version from package.json', async () => {
		const { VERSION } = await import('@sveltejs/kit');
		const pkg = JSON.parse(
			readFileSync(createRequire(import.meta.url).resolve('@sveltejs/kit/package.json'), 'utf-8')
		);
		assert.equal(
			VERSION,
			pkg.version,
			'VERSION export in src/version.js does not equal version in package.json'
		);
	});
});
