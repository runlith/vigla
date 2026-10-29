import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	mode: ['client', 'hydrate'],
	html: `
		<input><input><input><div>3</div>
	`
});
