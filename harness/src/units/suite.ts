import { join } from 'node:path';
import { assert, inject, it } from 'vitest';
import { faults, load, root } from '../manifest.ts';
import { suiteNamed, unitFile } from '../suites.ts';
import { govern, registered } from './vitest.ts';

export async function unitSuite(suite: string): Promise<void> {
	await import(inject('target').fresh);
	const manifest = load('svelte', suite);
	govern(suite, manifest);
	await import(join(root, 'samples', 'svelte', suite, unitFile(suiteNamed(suite))));
	it('manifest', () => {
		const missing = Object.keys(manifest.samples).filter((name) => !registered.includes(name));
		assert.deepEqual(
			{ missing, broken: faults(manifest) },
			{ missing: [], broken: [] },
			'manifest entries without a test, or faulty'
		);
	});
}
