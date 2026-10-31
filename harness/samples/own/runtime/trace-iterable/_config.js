import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	compileOptions: { dev: true },
	html: '<p>1</p><p>2</p>',
	test({ assert, instance }) {
		assert.equal(instance.traversals(), 1);
	}
});
