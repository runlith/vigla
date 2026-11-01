import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	props: { value: 1 },
	test({ assert, component, instance, target }) {
		assert.htmlEqual(target.innerHTML, '<p>1/1</p>\n<p>1/1</p>');
		assert.equal(instance.count(), 2);
		flushSync(() => component.value = 2);
		assert.htmlEqual(target.innerHTML, '<p>2/2</p>\n<p>2/2</p>');
		assert.equal(instance.count(), 4);
	}
});
