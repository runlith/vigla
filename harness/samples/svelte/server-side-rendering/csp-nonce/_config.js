import { test } from '@dromon/harness/helpers';

export default test({
	mode: ['async'],
	csp: { nonce: 'test-nonce' }
});
