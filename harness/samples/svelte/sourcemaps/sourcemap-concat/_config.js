import MagicString from 'magic-string';
import { test } from '@dromon/harness/helpers';
import { magic_string_preprocessor_result } from '@dromon/harness/sourcemaps';

export default test({
	preprocess: [
		{
			script: ({ content }) => {
				const src = new MagicString(content);
				src.prepend('console.log("Injected first line");\n');
				return magic_string_preprocessor_result('input.svelte', src);
			}
		}
	],
	client: ["'Target'"],
	preprocessed: ["'Target'"]
});
