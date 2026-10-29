import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	mode: ['client'],
	html: '<button>step</button> <p>effect 0</p> <p>teardown 0</p> <i>holder</i>',
	test({ assert, target, logs }) {
		logs.length = 0;
		flushSync(() => target.querySelector('button').click());
		assert.htmlEqual(target.innerHTML, '<button>step</button>');
		assert.deepEqual(logs, ['pre effect 1', 'effect effect 1']);
	}
});
