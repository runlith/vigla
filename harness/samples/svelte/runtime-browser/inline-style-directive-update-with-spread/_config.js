import { flushSync } from 'svelte';
import { assert_ok, test } from '@vigla/harness/helpers';

export default test({
	html: `
		<div style="background-color: rgb(255, 0, 0);"></div>
	`,

	test({ assert, target, window, component }) {
		const div = target.querySelector('div');
		assert_ok(div);
		const styles = window.getComputedStyle(div);
		assert.equal(styles.backgroundColor, 'rgb(255, 0, 0)');

		{
			flushSync(() => (component.backgroundColor = 128));
			const div = target.querySelector('div');
			assert_ok(div);
			const styles = window.getComputedStyle(div);
			assert.equal(styles.backgroundColor, 'rgb(128, 0, 0)');
		}
	}
});
