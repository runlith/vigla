import { test } from '@dromon/harness/helpers';

export default test({
	error: {
		code: 'svelte_meta_invalid_tag',
		message:
			'Valid `<svelte:...>` tag names are svelte:head, svelte:options, svelte:window, svelte:document, svelte:body, svelte:element, svelte:component, svelte:self, svelte:fragment or svelte:boundary',
		position: [10, 32]
	}
});
