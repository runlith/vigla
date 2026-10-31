import { hydrate } from 'vigla';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	runtime_error: 'hydration_failed',
	test({ instance, target, assert }) {
		(window.__vigla ??= {}).h = new Map([['key', 'server']]);
		const container = target.appendChild(document.createElement('main'));
		container.innerHTML = '<!--[--><p>server</p><i>extra</i><!--]-->';
		try {
			hydrate(instance.Child, { target: container, recover: false });
		} catch (error) {
			assert.equal(window.__vigla.h, undefined);
			throw error;
		} finally {
			container.remove();
		}
		assert.fail('Expected hydration to fail');
	}
});
