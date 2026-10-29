import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	html: `<div class="123"></div><img src="12 hello, world 13">`
});
