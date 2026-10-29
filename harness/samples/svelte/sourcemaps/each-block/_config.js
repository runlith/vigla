import { test } from '@vigla/harness/helpers';

export default test({
	client: ['foo', 'bar', { str: 'bar', idxGenerated: 1, idxOriginal: 1 }]
});
