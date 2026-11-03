import { flushSync, mount, unmount } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	html: '',
	async test({ assert, instance, raf }) {
		const target = document.body.appendChild(document.createElement('div'));
		try {
			const app = mount(instance.Child, { target });
			flushSync();
			let finished = false;
			const pending = unmount(app, { outro: true }).then(() => {
				finished = true;
			});
			flushSync();
			raf.tick(50);
			await Promise.resolve();
			assert.htmlEqual(target.innerHTML, '<p>leaving</p>');
			assert.equal(finished, false);
			raf.tick(150);
			await pending;
			assert.equal(finished, true);
			assert.htmlEqual(target.innerHTML, '');
		} finally {
			target.remove();
		}
	}
});
