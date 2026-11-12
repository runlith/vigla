import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target, logs }) {
		assert.equal(target.querySelector('p').textContent, 'init failed');
		assert.deepEqual(logs, ['released']);
	}
});
