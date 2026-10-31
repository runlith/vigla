import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	html: '<p>1</p><button>increment</button>',
	test({ assert, target }) {
		flushSync(() => target.querySelector('button').click());
		assert.htmlEqual(target.innerHTML, '<p>2</p><button>increment</button>');
	}
});
