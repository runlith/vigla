import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target, raf }) {
		const [toggle, cancel] = target.querySelectorAll('button');
		const node = target.querySelector('div');
		flushSync(() => toggle.click());
		raf.tick(25);
		assert.equal(+node.dataset.progress, 0.75);
		assert.equal(target.querySelector('output').textContent, '1');
		assert.equal(node.style.position, 'relative');
		assert.equal(node.style.getPropertyPriority('position'), 'important');
		flushSync(() => toggle.click());
		assert.equal(+node.dataset.progress, 1);
		flushSync(() => cancel.click());
		assert.equal(target.querySelector('div'), node);
		assert.equal(target.querySelector('output').textContent, '1');
		assert.equal(node.style.position, 'relative');
		assert.equal(node.style.getPropertyPriority('position'), 'important');
		flushSync(() => toggle.click());
		raf.tick(50);
		assert.equal(+node.dataset.progress, 0.75);
		assert.equal(target.querySelector('output').textContent, '2');
		raf.tick(125);
		assert.equal(target.querySelector('div'), null);
	}
});
