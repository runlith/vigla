import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client', 'hydrate'],
	snapshot(target) {
		return {
			select: target.querySelector('select'),
			option: target.querySelector('option'),
			paragraph: target.querySelector('p')
		};
	},
	test({ assert, target, variant, snapshot, warnings }) {
		const option = target.querySelector('option');
		if (variant === 'hydrate') {
			assert.equal(target.querySelector('select'), snapshot.select);
			assert.equal(option, snapshot.option);
			assert.equal(target.querySelector('p'), snapshot.paragraph);
		}
		assert.equal(option.querySelector('span').textContent, 'inner:FIRST');
		assert.equal(target.querySelector('option b').textContent, 'one');
		assert.equal(target.querySelector('optgroup .heading').textContent, 'first');
		assert.equal(target.querySelector('optgroup option em').textContent, 'first');
		flushSync(() => target.querySelector('button').click());
		assert.equal(option.querySelector('span').textContent, 'inner:SECOND');
		assert.equal(target.querySelector('option b').textContent, 'two');
		assert.equal(target.querySelector('optgroup .heading').textContent, 'second');
		assert.equal(target.querySelector('optgroup option em').textContent, 'second');
		assert.equal(target.querySelector('p').textContent, 'outer second');
		assert.deepEqual(warnings, []);
	}
});
