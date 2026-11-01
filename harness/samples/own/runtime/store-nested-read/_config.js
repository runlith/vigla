import { flushSync } from 'svelte';
import { writable } from 'svelte/store';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target, logs }) {
		logs.length = 0;
		flushSync(() => target.querySelector('button').click());
		assert.equal(target.querySelector('p').textContent, '1|1|1');
		flushSync(() => target.querySelectorAll('button')[1].click());
		assert.deepEqual(logs, ['0|0|0']);
		assert.equal(target.querySelector('p').textContent, '0|0|0');

		const store = writable(0);
		const values = [];
		let stopLater = () => {};
		const stopFirst = store.subscribeSync(value => {
			if (value === 1) stopLater = store.subscribeSync(next => values.push(next));
			if (value === 2) store.set(3);
		});
		try {
			store.set(1);
			assert.deepEqual(values, [1]);
			store.set(2);
			assert.deepEqual(values, [1, 3]);
		} finally {
			stopFirst();
			stopLater();
		}
	}
});
