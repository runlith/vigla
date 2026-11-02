import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	compileOptions: { dev: false },
	test({ assert, target }) {
		const calls = [];
		try {
			window.getHandler = () => () => calls.push(1);
			target.querySelector('button').click();
			window.getHandler = () => () => calls.push(2);
			target.querySelector('button').click();
			assert.deepEqual(calls, [1, 2]);
		} finally {
			delete window.getHandler;
		}
	}
});
