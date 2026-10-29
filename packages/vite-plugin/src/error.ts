import type { Rollup } from 'vite';
import type { CompileError, PreprocessorGroup } from './compiler.ts';
import { buildExtendedLogMessage } from './log.ts';
import { arraify, type ResolvedOptions } from './options.ts';

const styleTag =
	/<!--[^]*?-->|<style((?:\s+[^=>'"/]+=(?:"[^"]*"|'[^']*'|[^>\s]+)|\s+[^=>'"/]+)*\s*)(?:\/>|>([\S\s]*?)<\/style>)/g;

function viteFrame(frame: string | undefined): string {
	if (!frame) return '';
	return frame
		.split('\n')
		.map((line) => (/^\s+\^/.test(line) ? `   ${line}` : ` ${line.replace(':', ' | ')}`))
		.join('\n');
}

export function toRollupError(error: CompileError, options: ResolvedOptions): Rollup.RollupError {
	const { filename, frame, start, code, name, stack } = error;
	const converted: Rollup.RollupError = {
		name,
		id: filename,
		message: buildExtendedLogMessage(error),
		frame: viteFrame(frame),
		code,
		stack: options.isBuild || options.isDebug || !frame ? stack : ''
	};
	if (start) converted.loc = { line: start.line, column: start.column, file: filename };
	return converted;
}

function fixableByCssPreprocessor(code: string | undefined): boolean {
	return code === 'expected_token' || code === 'unexpected_eof' || !!code?.startsWith('css_');
}

export function enhanceCompileError(
	error: CompileError,
	source: string,
	preprocess: PreprocessorGroup | PreprocessorGroup[] | undefined
): CompileError {
	const groups = arraify(preprocess);
	const notes: string[] = [];
	if (fixableByCssPreprocessor(error.code)) {
		for (const match of source.matchAll(styleTag)) {
			if (match[0].startsWith('<!--')) continue;
			if (!match[1]?.includes('lang=')) {
				notes.push('Did you forget to add a lang attribute to your style tag?');
			}
			if (
				groups.every(
					(group) => group.style == null || group.name === 'inject-scope-everything-rule'
				)
			) {
				const lang = match[1]?.match(/lang="(.+?)"/)?.[1] ?? 'style';
				notes.push(
					`Did you forget to add a ${lang} preprocessor? See https://github.com/sveltejs/vite-plugin-svelte/blob/main/docs/preprocess.md for more information.`
				);
			}
		}
	}
	if (notes.length > 0) error.message += `\n\n- ${notes.join('\n- ')}`;
	return error;
}
