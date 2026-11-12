import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ assert, target }) {
		await tick();
		const [first, second, hide, show, resolve] = target.querySelectorAll('button');
		const press = async (button) => {
			button.click();
			await tick();
		};
		await press(first);
		await press(second);
		await press(resolve);
		assert.equal(target.querySelectorAll('span').length, 1);
		assert.equal(target.querySelector('p').textContent, '1');
		await press(hide);
		await press(show);
		await press(resolve);
		assert.equal(target.querySelector('p').textContent, '2');
		assert.equal(target.querySelectorAll('span').length, 0);
	}
});
