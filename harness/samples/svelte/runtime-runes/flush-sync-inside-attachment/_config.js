import { test } from '@vigla/harness/helpers';

export default test({
	async test({ assert, target, logs }) {
		assert.htmlEqual(target.innerHTML, `<button>show</button> <div>hello</div>`);
		assert.deepEqual(logs, ['hello']);
	}
});
