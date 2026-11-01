import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	compileOptions: {
		css: 'injected',
		warningFilter: (warning) => warning.code !== 'css_unused_selector'
	},
	async test({ assert, target }) {
		await new Promise((resolve) => setTimeout(resolve, 0));
		assert.equal(getComputedStyle(target.querySelector('.red')).backgroundColor, 'rgb(255, 0, 0)');
		flushSync(() => target.querySelector('button').click());
		await new Promise((resolve) => setTimeout(resolve, 0));
		assert.equal(getComputedStyle(target.querySelector('.yellow')).backgroundColor, 'rgb(255, 255, 0)');
		flushSync(() => target.querySelector('button').click());
		await new Promise((resolve) => setTimeout(resolve, 0));
		assert.equal(getComputedStyle(target.querySelector('.red')).backgroundColor, 'rgb(255, 0, 0)');
	}
});
