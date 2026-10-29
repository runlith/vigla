import { tick } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	mode: ['async-server', 'client', 'hydrate'],
	ssrHtml: 'value value <div>false</div> <input value="value"> <input value="value">',

	async test({ assert, target, logs }) {
		await tick();

		assert.htmlEqual(target.innerHTML, 'value value <div>true</div> <input> <input>');
		assert.deepEqual(logs, [false, 'value', true, 'value']);
	}
});
