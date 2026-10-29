import { flushSync, tick } from 'svelte';
import { test } from '@vigla/harness/helpers';
import { probe } from './world.js';

async function flush() {
	for (let i = 0; i < 6; i += 1) await tick();
	await Promise.resolve();
}

export default test({
	mode: ['client'],
	async test({ assert, target }) {
		const [recycle, open] = target.querySelectorAll('button');
		const found = () => [...target.querySelectorAll('p')].map((node) => node.textContent);
		assert.equal(target.querySelector('i')?.textContent, 'loading');
		await flush();
		assert.deepEqual(found(), ['hit:book#1']);
		const loaded = probe.loaded;

		flushSync(() => recycle.click());
		await flush();
		assert.deepEqual(found(), []);

		flushSync(() => open.click());
		await flush();
		assert.deepEqual(found(), ['hit:book#2']);
		assert.equal(probe.loaded, loaded);
	}
});
