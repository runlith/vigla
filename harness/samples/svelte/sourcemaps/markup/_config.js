import { test } from '@dromon/harness/helpers';

export default test({
	skip: true, // TODO no source maps here; Svelte 4 added some for static templates due to https://github.com/sveltejs/svelte/issues/6092
	client: []
});
