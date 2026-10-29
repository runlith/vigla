import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	mode: ['client'],
	html: '<button>release</button> <b>1</b> <p>holder</p>',
	test({ assert, target, logs }) {
		target.querySelector('button').click();
		flushSync();
		assert.deepEqual(logs, []);
		assert.htmlEqual(target.innerHTML, '<button>release</button>');
	}
});
