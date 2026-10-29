import { test } from '@dromon/harness/helpers';

export default test({
	mode: ['client', 'server'],

	html: `<span>x</span>`,
	ssrHtml: `<span>x</span>`
});
