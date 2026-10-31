import { cell, effect, flushSync, getAbortSignal, root, untrack } from 'vigla';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert }) {
		assert.throws(() => getAbortSignal(), /get_abort_signal_outside_reaction/);
		const value = cell(0);
		const signals = [];
		const owner = root(() => {
			effect(() => {
				value.current;
				const signal = getAbortSignal();
				assert.strictEqual(getAbortSignal(), signal);
				assert.strictEqual(untrack(getAbortSignal), signal);
				const detached = root(() => {
					assert.throws(() => getAbortSignal(), /get_abort_signal_outside_reaction/);
				});
				detached.dispose();
				signal.addEventListener('abort', () => {
					assert.throws(() => getAbortSignal(), /get_abort_signal_outside_reaction/);
				});
				signals.push(signal);
			});
		});
		try {
			flushSync();
			assert.equal(signals[0].aborted, false);
			value.current++;
			flushSync();
			assert.equal(signals[0].aborted, true);
			assert.equal(signals[0].reason.name, 'StaleReactionError');
			assert.equal(signals[1].aborted, false);
		} finally {
			owner.dispose();
		}
		assert.equal(signals[1].aborted, true);
	}
});
