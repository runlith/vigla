import MagicString from 'magic-string';
import { test } from '@vigla/harness/helpers';
import { magic_string_preprocessor_result, magic_string_replace_all } from '@vigla/harness/sourcemaps';

export default test({
	preprocess: {
		markup: ({ content, filename = '' }) => {
			const src = new MagicString(content);
			magic_string_replace_all(src, 'replace me', 'success');
			return magic_string_preprocessor_result(filename, src);
		}
	},
	client: [],
	preprocessed: [{ str: 'replace me', strGenerated: 'success' }]
});
