import MagicString from 'magic-string';
import { test } from '@vigla/harness/helpers';
import { magic_string_preprocessor_result, magic_string_replace_all } from '@vigla/harness/sourcemaps';

export default test({
	preprocess: {
		script: ({ content, filename = '' }) => {
			const src = new MagicString(content);
			magic_string_replace_all(src, 'baritone', 'bar');
			return magic_string_preprocessor_result(filename, src);
		}
	},
	client: [{ str: 'baritone', strGenerated: 'bar' }, 'baz']
});
