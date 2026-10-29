import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

async function flush() {
	for (let i = 0; i < 6; i += 1) await tick();
	await Promise.resolve();
}

const buttons = '<button>a</button> <button>fork</button> <button>release</button> <button>commit</button>';

export default test({
	mode: ['client'],
	async test({ assert, target, logs }) {
		await flush();
		const [a, forkButton, release, commit] = target.querySelectorAll('button');
		a.click();
		await flush();
		forkButton.click();
		await flush();
		release.click();
		await flush();
		assert.htmlEqual(target.innerHTML, `${buttons} <p>1</p>`);
		assert.deepEqual(logs, ['built'], 'the fork builds its branch once its value lands');

		commit.click();
		await flush();
		assert.htmlEqual(target.innerHTML, `${buttons} <p>1</p> <b>forked</b>`);
		assert.deepEqual(logs, ['built']);
	}
});
