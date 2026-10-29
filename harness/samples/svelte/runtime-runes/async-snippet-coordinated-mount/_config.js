import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	async test({ assert, target }) {
		const [shift] = target.querySelectorAll('button');

		shift.click();
		await tick();

		assert.htmlEqual(target.innerHTML, `<button>shift</button><p>loading...</p>`);

		shift.click();
		await tick();

		assert.htmlEqual(
			target.innerHTML,
			`
				<button>shift</button>
				<p>message: hello from child</p>
				<p>hello from parent</p>
			`
		);
	}
});
