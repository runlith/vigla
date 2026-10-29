import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	html: '<button>outer</button>',

	test({ assert, target }) {
		const button = target.querySelector('button');
		flushSync(() => {
			button?.click();
		});
		assert.htmlEqual(target.innerHTML, '<button>changed</button>');
	}
});
