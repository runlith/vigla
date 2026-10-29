import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';
import { normalise_trace_logs } from '@dromon/harness/helpers';

export default test({
	compileOptions: {
		dev: true
	},

	test({ assert, target, logs }) {
		// initial log, everything is highlighted

		assert.deepEqual(normalise_trace_logs(logs), [
			{ log: 'iife' },
			{ log: '$state', highlighted: true },
			{ log: 'count', highlighted: false },
			{ log: 0 },
			{ log: 'effect' }
		]);

		logs.length = 0;

		const button = target.querySelector('button');
		button?.click();
		flushSync();

		assert.deepEqual(normalise_trace_logs(logs), [
			{ log: 'iife' },
			{ log: '$state', highlighted: true },
			{ log: 'count', highlighted: false },
			{ log: 1 },
			{ log: 'effect' }
		]);
	}
});
