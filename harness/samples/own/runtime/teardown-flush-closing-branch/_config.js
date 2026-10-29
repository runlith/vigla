import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	mode: ['client'],
	html: '<button>close</button> <p>open</p>',
	test({ assert, target, logs }) {
		target.querySelector('button').click();
		flushSync();
		assert.htmlEqual(target.innerHTML, '<button>close</button>');
		assert.deepEqual(logs, [0, 1]);
	}
});
