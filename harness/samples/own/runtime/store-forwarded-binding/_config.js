import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	html: '<button>increment</button><p>0</p>',
	test({ assert, target }) {
		flushSync(() => target.querySelector('button').click());
		assert.htmlEqual(target.innerHTML, '<button>increment</button><p>1</p>');
	}
});
