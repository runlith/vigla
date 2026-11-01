import { test } from '@vigla/harness/helpers';

const moduleUrl = 'data:text/javascript,export const foo = "foo"';
const namespace = await import(/* @vite-ignore */ moduleUrl);

export default test({
	mode: ['server', 'async-server'],
	props: { namespace },
	html: '<p>bar</p>'
});
