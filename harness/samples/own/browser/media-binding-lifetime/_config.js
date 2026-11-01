import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	props: { shown: true, time: 0, width: undefined, height: undefined },
	async test({ assert, component, target }) {
		const media = target.querySelector('video');
		flushSync(() => component.time = 1);
		assert.equal(media.currentTime, 1);
		media.currentTime = 2;
		flushSync(() => media.dispatchEvent(new Event('timeupdate')));
		assert.equal(component.time, 2);
		flushSync(() => component.shown = false);
		media.currentTime = 3;
		media.dispatchEvent(new Event('timeupdate'));
		await new Promise(requestAnimationFrame);
		flushSync();
		assert.equal(component.time, 2);
		assert.equal(target.querySelector('output').textContent, '2');
		flushSync(() => {
			component.width = 123;
			component.height = 456;
		});
		flushSync(() => media.dispatchEvent(new Event('resize')));
		assert.deepEqual([component.width, component.height], [123, 456]);
	}
});
