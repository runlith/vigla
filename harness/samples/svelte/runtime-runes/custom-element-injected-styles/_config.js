import { tick } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	mode: ['client'],
	async test({ assert, target }) {
		const thing = /** @type HTMLElement & { object: { test: true }; } */ (
			target.querySelector('my-thing')
		);

		await tick();

		assert.include(thing.shadowRoot?.innerHTML, 'red');
	}
});
