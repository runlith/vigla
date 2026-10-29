import { basename } from 'node:path';
import MagicString, { Bundle } from 'magic-string';

export function magic_string_bundle(
	inputs: readonly { code: string | MagicString; filename: string }[],
	filename = 'bundle.js',
	separator = '\n'
) {
	const bundle = new Bundle({ separator });
	for (const { code, filename } of inputs) {
		bundle.addSource({
			filename,
			content: typeof code === 'string' ? new MagicString(code) : code
		});
	}
	return {
		code: bundle.toString(),
		map: bundle.generateMap({ source: filename, hires: true, includeContent: false })
	};
}

export function magic_string_preprocessor_result(filename: string, src: MagicString) {
	return {
		code: src.toString(),
		map: src.generateMap({ source: basename(filename), hires: true, includeContent: false })
	};
}

export function magic_string_replace_all(src: MagicString, search: string, replace: string): void {
	let index = src.original.indexOf(search);
	if (index === -1) throw new Error('search not found in src');
	do {
		src.overwrite(index, index + search.length, replace, { storeName: true });
	} while ((index = src.original.indexOf(search, index + 1)) !== -1);
}
