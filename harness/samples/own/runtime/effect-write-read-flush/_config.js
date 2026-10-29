import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	mode: ['client'],
	html: '<button>reveal</button> <p>0</p>',
	test({ assert, target }) {
		target.querySelector('button').click();
		flushSync();
		assert.htmlEqual(target.innerHTML, '<button>reveal</button> <p>1</p>');
	}
});
