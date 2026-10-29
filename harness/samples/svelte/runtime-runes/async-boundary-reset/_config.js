import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	async test({ assert, target }) {
		await tick();
		let [btn] = target.querySelectorAll('button');
		btn.click();
		await tick();

		assert.htmlEqual(target.innerHTML, '<button>reset</button>');

		[btn] = target.querySelectorAll('button');
		btn.click();
		await tick();

		assert.htmlEqual(target.innerHTML, '<button>ok</button>');
	}
});
