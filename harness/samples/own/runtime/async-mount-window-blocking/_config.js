import { flushSync, tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

async function flush() {
	for (let i = 0; i < 6; i += 1) await tick();
	await Promise.resolve();
}

export default test({
	mode: ['client'],
	async test({ assert, target, logs }) {
		const [show, respond, release] = target.querySelectorAll('button');
		flushSync(() => show.click());
		await new Promise((resolve) => setTimeout(resolve, 0));
		respond.click();
		await flush();
		release.click();
		await flush();

		assert.htmlEqual(
			target.innerHTML,
			'<button>show</button> <button>respond</button> <button>release</button> <p>hit:book</p>'
		);
		assert.equal(logs.at(-1), '1/2');
	}
});
