import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	compileOptions: { dev: true },
	error: 'snippet_without_render_tag'
});
