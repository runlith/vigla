import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	test({ assert, target }) {
		assert.htmlEqual(target.innerHTML, 'a\n<select></select><button>change</button');

		const [b1] = target.querySelectorAll('button');
		b1.click();
		flushSync();

		assert.htmlEqual(
			target.innerHTML,
			'a\n<select></select>b\n<select></select><button>change</button'
		);
	}
});
