import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';
import { expect, vi } from 'vitest';

const handler = vi.fn();

export default test({
	props: {
		handler
	},
	async test({ target }) {
		const button = target.querySelector('button');
		const video = target.querySelector('video');

		button?.click();
		flushSync();
		video?.dispatchEvent(new Event('someevent'));
		expect(handler).not.toHaveBeenCalled();
	}
});
