import { settled } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ assert, target, window }) {
		const turn = () => new Promise(resolve => setTimeout(resolve, 0));
		await turn();
		const probe = window.eachProbe;
		probe.release();
		await turn();
		probe.reset();
		try {
			target.querySelector('button').click();
			await turn();
			target.querySelector('button').click();
			await turn();
			probe.release(3);
			await turn();
			const count = probe.count();
			await turn();
			assert.equal(probe.count(), count);
			assert.isBelow(count, 12);
		} finally {
			probe.release();
			delete window.eachProbe;
		}
		await settled();
		assert.deepEqual([...target.querySelectorAll('p')].map(node => node.textContent), ['2', '4', '6']);
	}
});
