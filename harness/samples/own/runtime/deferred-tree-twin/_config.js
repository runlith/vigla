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
		await flush();
		assert.equal(probe.loaded, 0);
		assert.htmlEqual(target.innerHTML, '<button>open</button>');

		flushSync(() => target.querySelector('button').click());
		assert.htmlEqual(target.innerHTML, '<button>open</button>');

		await flush();
		const found = [...target.querySelectorAll('p')].map((node) => node.textContent);
		assert.deepEqual(found, ['hit:book#1', 'hit:book#1']);
		assert.equal(probe.loaded, 1);
		assert.equal(probe.built, 1);
	}
});
