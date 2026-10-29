import { test } from '@vigla/harness/helpers';

export default test({
	compileOptions: {
		dev: true
	},

	mode: ['client'],

	error: 'each_key_volatile'
});
