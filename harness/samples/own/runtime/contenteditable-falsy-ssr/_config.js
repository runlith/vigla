import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['server', 'async-server'],
	ssrHtml: '<div contenteditable>fallback</div><div contenteditable>0</div>'
});
