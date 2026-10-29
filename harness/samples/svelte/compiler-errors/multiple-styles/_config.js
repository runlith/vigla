import { test } from '@vigla/harness/helpers';

export default test({
	error: {
		code: 'style_duplicate',
		message: 'A component can have a single top-level `<style>` element',
		position: [58, 58]
	}
});
