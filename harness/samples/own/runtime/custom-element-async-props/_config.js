import { flushSync, tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ target, assert }) {
		await Promise.resolve();
		const host = target.querySelector('async-prop-panel');
		host.queued = 2;
		await tick();
		assert.equal(host.count, 0);
		assert.equal(host.getAttribute('queued'), '2');
		host.count = 2;
		flushSync();
		assert.equal(host.getAttribute('count'), '2');
		assert.equal(host.shadowRoot.querySelector('p').textContent, '2/2');
	}
});
