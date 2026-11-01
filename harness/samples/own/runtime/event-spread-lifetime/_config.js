import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client', 'hydrate'],
	async test({ assert, target, window }) {
		const [update, toggle] = target.querySelectorAll('button');
		const first = target.querySelector('video');
		await Promise.resolve();
		flushSync(() => update.click());
		first.dispatchEvent(new window.Event('pointerdown'));
		flushSync();
		assert.equal(target.querySelector('p').textContent, '1');
		flushSync(() => toggle.click());
		first.dispatchEvent(new window.Event('pointerdown'));
		flushSync();
		assert.equal(target.querySelector('p').textContent, '1');
		flushSync(() => toggle.click());
		const second = target.querySelector('video');
		flushSync(() => toggle.click());
		await Promise.resolve();
		second.dispatchEvent(new window.Event('pointerdown'));
		flushSync();
		assert.equal(target.querySelector('p').textContent, '1');
	}
});
