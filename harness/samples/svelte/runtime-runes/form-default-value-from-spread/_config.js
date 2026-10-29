import { test } from '@dromon/harness/helpers';

export default test({
	mode: ['server'],
	html: `
		<input value="a">
		<input type="checkbox" checked>
		<input value="b">
`
});
