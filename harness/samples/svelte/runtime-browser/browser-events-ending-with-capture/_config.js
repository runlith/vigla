import { tick } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	async test({ assert, window }) {
		const div = window.document.querySelector('div');

		div?.dispatchEvent(new PointerEvent('gotpointercapture'));
		div?.dispatchEvent(new PointerEvent('lostpointercapture'));

		await tick();

		assert.equal(div?.dataset.lostCaptured, 'true');
		assert.equal(div?.dataset.gotCaptured, 'true');
	}
});
