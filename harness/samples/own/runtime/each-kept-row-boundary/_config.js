import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target, logs }) {
		const add = target.querySelector('button.add');
		add.click();
		flushSync();
		target.querySelector('button.count').click();
		flushSync();
		assert.equal(target.querySelector('button.count').textContent, '0: 1');
		add.click();
		flushSync();
		assert.equal(target.querySelector('p').textContent, 'row 1 failed');
		add.click();
		flushSync();
		assert.deepEqual(logs, ['built 0', 'built 1', 'reported row 1 failed', 'built 2']);
		assert.deepEqual(
			[...target.querySelectorAll('button.count')].map((button) => button.textContent),
			['0: 1', '2: 0']
		);
		assert.equal(target.querySelectorAll('p').length, 1);
	}
});
