import { flushSync, unmount } from 'svelte';
import { test } from '@vigla/harness/helpers';

const settled = (promise) =>
	Promise.race([promise.then(() => 'resolved'), new Promise((done) => setTimeout(done, 20, 'hung'))]);

export default test({
	mode: ['client'],
	html: '',
	async test({ assert, instance, raf }) {
		const target = document.body.appendChild(document.createElement('div'));
		try {
			const during = instance.rooted(target);
			flushSync();
			const first = unmount(during.app, { outro: true });
			raf.tick(50);
			assert.htmlEqual(target.innerHTML, '<p>leaving</p>');
			during.stop();
			assert.htmlEqual(target.innerHTML, '');
			assert.equal(await settled(first), 'resolved');

			let stop;
			const inside = instance.rooted(target, { oncall: () => stop?.() });
			stop = inside.stop;
			flushSync();
			const second = unmount(inside.app, { outro: true });
			assert.htmlEqual(target.innerHTML, '');
			assert.equal(await settled(second), 'resolved');
		} finally {
			target.remove();
		}
	}
});
