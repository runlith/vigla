import { flushSync, hydrate, mount, unmount } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client', 'hydrate'],
	async test({ assert, target, window, instance }) {
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

		const frame = window.document.createElement('iframe');
		window.document.body.append(frame);
		try {
			const doc = frame.contentDocument;
			for (const hydrating of [false, true]) {
				const container = doc.createElement('div');
				doc.body.append(container);
				let calls = 0;
				if (hydrating) container.innerHTML = '<!--[--><video></video><!--]-->';
				const options = { target: container, props: { handler: () => calls++ } };
				const component = hydrating
					? hydrate(instance.Media, options)
					: mount(instance.Media, options);
				const video = container.querySelector('video');
				video.dispatchEvent(new frame.contentWindow.Event('someevent'));
				assert.equal(calls, 1);
				await unmount(component);
				video.dispatchEvent(new frame.contentWindow.Event('someevent'));
				assert.equal(calls, 1);
				container.remove();
			}
		} finally {
			frame.remove();
		}
	}
});
