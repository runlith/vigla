import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	html: '<button>hide</button> <button>write</button> <p>0</p>',
	test({ assert, target, logs }) {
		const [hide, write] = target.querySelectorAll('button');
		assert.deepEqual(logs, ['derived 0', 'effect 0']);
		flushSync(() => hide.click());
		assert.deepEqual(logs, ['derived 0', 'effect 0', 'teardown']);
		flushSync(() => write.click());
		flushSync(() => write.click());
		assert.htmlEqual(target.innerHTML, '<button>hide</button> <button>write</button>');
		assert.deepEqual(logs, ['derived 0', 'effect 0', 'teardown']);
	}
});
