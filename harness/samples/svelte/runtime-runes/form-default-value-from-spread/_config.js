import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['server'],
	html: `
		<input value="a">
		<input type="checkbox" checked>
		<input value="b">
`
});
