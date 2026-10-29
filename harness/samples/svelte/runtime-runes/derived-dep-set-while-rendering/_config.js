import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	async test({ assert, target }) {
		const [show, hide] = target.querySelectorAll('button');

		hide.click();
		flushSync();
		assert.htmlEqual(
			target.innerHTML,
			`
			<button>show</button>
			<button>hide</button>
		`
		);

		show.click();
		flushSync();
		assert.htmlEqual(
			target.innerHTML,
			`
			<button>show</button>
			<button>hide</button>
			<div>visible</div>
		`
		);
	}
});
