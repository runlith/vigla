import { test } from '@vigla/harness/helpers';

/** @type {typeof console.log} */
let log;

export default test({
	before_test() {
		log = console.log;
		console.log = () => {};
	},

	after_test() {
		console.log = log;
	}
});
