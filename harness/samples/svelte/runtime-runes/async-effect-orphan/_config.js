import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	async test({ assert, logs }) {
		await tick();

		assert.deepEqual(logs, [
			`effect_orphan\n\`$effect\` can only be used inside an effect (e.g. during component initialisation)\nhttps://svelte.dev/e/effect_orphan`
		]);
	}
});
