import { cell, flushSync } from 'vigla';
import { test } from '@vigla/harness/helpers';

let owner;
let stop;
const state = {
	input: cell(0),
	detached: cell(0),
	registerStop: (dispose) => { stop = dispose; },
	outer: [],
	inner: [],
	register: (scope) => { owner = scope; },
	reportOuter: (error) => state.outer.push(error.message)
};

export default test({
	mode: ['client'],
	props: { state },
	test({ assert, target }) {
		assert.deepEqual(state.outer, []);
		const remove = owner.onError((error) => state.inner.push(error.message));
		state.input.current = 1;
		flushSync();
		assert.deepEqual(state.inner, ['1']);
		assert.deepEqual(state.outer, []);
		assert.htmlEqual(target.innerHTML, '<p>service</p>');
		remove();
		try {
			state.detached.current = 1;
			flushSync();
			assert.deepEqual(state.inner, ['1']);
			assert.deepEqual(state.outer, ['replacement']);
		} finally {
			stop();
		}
	}
});
