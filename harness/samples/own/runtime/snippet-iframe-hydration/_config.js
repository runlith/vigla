import { hydrate as claim, unmount } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	compileOptions: { dev: true },
	async test({ assert, mod, window }) {
		const frame = window.document.createElement('iframe');
		window.document.body.append(frame);
		try {
			const target = frame.contentDocument.body;
			target.innerHTML = '<!--[--><p>42</p><!--]-->';
			const instance = claim(mod.default, { target });
			assert.htmlEqual(target.innerHTML, '<p>42</p>');
			await unmount(instance);
			assert.htmlEqual(target.innerHTML, '');
		} finally {
			frame.remove();
		}
	}
});
