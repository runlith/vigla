import { flushSync, tick } from 'svelte';
import { test } from '@dromon/harness/helpers';

async function flush() {
	for (let i = 0; i < 6; i += 1) await tick();
	await Promise.resolve();
}

const buttons = '<button>a</button> <button>b</button> <button>resolve</button>';

export default test({
	mode: ['client'],
	async test({ assert, target, logs }) {
		const [a, b, resolve] = target.querySelectorAll('button');
		flushSync(() => a.click());
		await flush();
		assert.htmlEqual(target.innerHTML, `${buttons} <p>1 0</p> <i>loading</i>`, 'once a is written');

		flushSync(() => b.click());
		assert.htmlEqual(target.innerHTML, `${buttons} <p>1 1</p> <i>loading</i>`, 'once b is written');

		resolve.click();
		await flush();
		assert.htmlEqual(target.innerHTML, `${buttons} <p>1 1</p> <b>done</b>`, 'once resolved');
		assert.deepEqual(logs, ['0 0', '1 0', '1 1']);
	}
});
