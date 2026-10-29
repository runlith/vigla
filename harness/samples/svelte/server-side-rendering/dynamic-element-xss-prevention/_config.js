import { test } from '@vigla/harness/helpers';

export default test({
	props: {
		tag: 'svg onload=alert(1)'
	},
	error: 'dynamic_element_invalid_tag'
});
