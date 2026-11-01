import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ assert, target, window }) {
		const turn = () => new Promise(resolve => setTimeout(resolve, 0));
		await turn();
		const probe = window.cacheProbe;
		probe.release();
		await turn();
		probe.reset();
		const [next, toggle] = target.querySelectorAll('button');
		try {
			next.click();
			await turn();
			probe.reset();
			toggle.click();
			await turn();
			const [parsed, cells] = probe.counts();
			assert.isAtMost(parsed, 1);
			assert.equal(cells, 1);
		} finally {
			probe.release();
			await tick();
			delete window.cacheProbe;
		}
	}
});
