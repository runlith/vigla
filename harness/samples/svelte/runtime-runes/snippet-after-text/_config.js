import { test } from '@vigla/harness/helpers';

export default test({
	compileOptions: {
		dev: true // Render in dev mode to check that the validation error is not thrown
	},
	html: `<div>123</div`
});
