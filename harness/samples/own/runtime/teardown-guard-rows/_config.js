import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	mode: ['client'],
	html: '<button>leave</button> <span hidden></span> <aside><a>zero · main</a><a>one · main</a></aside>',
	test({ assert, target, logs }) {
		target.querySelector('button').click();
		flushSync();
		assert.deepEqual(logs, []);
		assert.htmlEqual(target.innerHTML, '<button>leave</button>');
	}
});
