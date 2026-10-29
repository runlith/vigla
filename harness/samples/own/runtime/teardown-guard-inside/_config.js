import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	html: '<button>release</button> <p>holder</p> <b>1</b>',
	test({ assert, target, logs }) {
		target.querySelector('button').click();
		flushSync();
		assert.deepEqual(logs, []);
		assert.htmlEqual(target.innerHTML, '<button>release</button>');
	}
});
