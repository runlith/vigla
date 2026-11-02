import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target, raf }) {
		const source = target.querySelector('[data-key]');
		const unmatched = target.querySelector('[data-unmatched]');
		flushSync(() => target.querySelector('button').click());
		raf.tick(7);
		raf.tick(107);
		const receiver = [...target.querySelectorAll('[data-key]')].find((node) => node !== source);
		for (const node of [source, receiver]) {
			assert.equal(+node.dataset.calls, 1);
			assert.equal(+node.dataset.distance, 0);
			assert.equal(+node.dataset.duration, 100);
			assert.equal(+node.dataset.delay, 7);
			assert.equal(+node.dataset.easing, 1);
		}
		assert.equal(source.style.opacity, '0.75');
		assert.equal(source.style.outlineWidth, '7.5px');
		assert.equal(+source.dataset.sample, 0.75);
		assert.equal(receiver.style.opacity, '0.25');
		assert.equal(+receiver.dataset.sample, 0.25);
		assert.equal(+unmatched.dataset.calls, 0);
		assert.equal(+unmatched.dataset.duration, 200);
		assert.equal(+unmatched.dataset.delay, 7);
		assert.equal(+unmatched.dataset.easing, 1);
		assert.equal(+unmatched.dataset.fallbackCalls, 1);
		assert.equal(+unmatched.dataset.fallback, 0.9375);
		assert.equal(+unmatched.dataset.sample, 0.9375);
		raf.tick(207);
		assert.equal(target.querySelector('[data-key]'), receiver);
		assert.equal(target.querySelectorAll('[data-key]').length, 1);
		assert.equal(target.querySelector('[data-unmatched]'), unmatched);
		raf.tick(407);
		assert.equal(target.querySelector('[data-unmatched]'), null);
	}
});
