import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client', 'server'],

	html: `<span>x</span>`,
	ssrHtml: `<span>x</span>`
});
