import { test } from '@vigla/harness/helpers';

export default test({
	error: {
		code: 'element_unclosed',
		message: '`<script>` was left open',
		position: [32, 32]
	}
});
