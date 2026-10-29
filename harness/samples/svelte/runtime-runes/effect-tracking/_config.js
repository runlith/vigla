import { test } from '@dromon/harness/helpers';

export default test({
	ssrHtml: `
		<p>false</p>
		<p>false</p>
		<p>false</p>
		<p>false</p>
	`,

	html: `
		<p>false</p>
		<p>true</p>
		<p>true</p>
		<p>false</p>
	`
});
