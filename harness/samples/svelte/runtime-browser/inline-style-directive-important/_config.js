import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	html: `
		<h1 class="svelte-szzkfu" style="background-color: red;">hello</h1>
		<h1 class="svelte-szzkfu" style="background-color: red !important;">hello</h1>
	`,

	ssrHtml: `
		<h1 class="svelte-szzkfu" style="background-color: red;">hello</h1>
		<h1 class="svelte-szzkfu" style="background-color: red !important;">hello</h1>
	`,

	test({ assert, target, window, component }) {
		const h1s = target.querySelectorAll('h1');

		assert.equal(window.getComputedStyle(h1s[0])['backgroundColor'], 'rgb(0, 0, 255)');
		assert.equal(window.getComputedStyle(h1s[1])['backgroundColor'], 'rgb(255, 0, 0)');

		flushSync(() => (component.color = 'yellow'));
		assert.equal(window.getComputedStyle(h1s[0])['backgroundColor'], 'rgb(0, 0, 255)');
		assert.equal(window.getComputedStyle(h1s[1])['backgroundColor'], 'rgb(255, 255, 0)');
	}
});
