import { test } from '@vigla/harness/helpers';

export default test({
	error: {
		code: 'store_invalid_subscription',
		message: 'Cannot reference store value inside `<script module>`',
		position: [154, 158]
	}
});
