import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	mode: ['client'],
	html: '<button>leave</button> <p>page</p> <b class="on">0</b>',
	test({ assert, target, logs }) {
		target.querySelector('button').click();
		flushSync();
		assert.deepEqual(logs, []);
		assert.htmlEqual(target.innerHTML, '<button>leave</button>');
	}
});
