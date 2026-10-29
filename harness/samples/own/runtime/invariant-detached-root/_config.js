import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target, logs }) {
		const button = target.querySelector('button');
		logs.length = 0;
		button.click();
		flushSync();
		assert.htmlEqual(target.innerHTML, '<button>1</button>');
		assert.deepEqual([...logs].sort(), ['component 1', 'root 1']);
		logs.length = 0;
		flushSync(() => button.click());
		assert.htmlEqual(target.innerHTML, '<button>2</button>');
		assert.deepEqual([...logs].sort(), ['component 2', 'root 2']);
	}
});
