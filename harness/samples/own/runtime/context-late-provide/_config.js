import { flushSync, settled } from 'svelte';
import { test } from '@vigla/harness/helpers';

const page = '<p>user:ada</p><button>late</button><button>show</button>';

export default test({
	mode: ['client', 'hydrate', 'async-server'],
	ssrHtml: page,
	async test({ assert, target }) {
		await settled();
		assert.htmlEqual(target.innerHTML, page);
		const [late, show] = target.querySelectorAll('button');
		flushSync(() => late.click());
		flushSync(() => show.click());
		assert.htmlEqual(target.innerHTML, `${page}<p>theme:dark</p>`);
	}
});
