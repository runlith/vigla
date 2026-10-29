import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target, logs }) {
		const [drop, bump] = target.querySelectorAll('button');
		assert.deepEqual(logs, ['service 1']);
		flushSync(() => drop.click());
		flushSync(() => bump.click());
		assert.deepEqual(logs, ['service 1', 'service 2']);
	}
});
