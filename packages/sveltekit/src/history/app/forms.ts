import { DEV } from 'esm-env';
import { enhance as enhanceForm, type SubmitFunction } from '$app/forms';
import { warnDiagnostic } from '../diagnostics.ts';

export * from '$app/forms';

interface RetiredUpdateOptions {
	reset?: boolean;
	refreshAll?: boolean;
	navigate?: boolean;
	invalidateAll?: boolean;
}

interface Submission {
	update(options?: RetiredUpdateOptions): Promise<void>;
}

type Callback = (submission: Submission) => unknown;

function current(options?: RetiredUpdateOptions): RetiredUpdateOptions | undefined {
	if (options?.invalidateAll === undefined) return options;
	if (DEV)
		warnDiagnostic(
			'enhance_invalidate_all_deprecated',
			'The `update({ invalidateAll })` option has been deprecated in favour of `update({ refreshAll })`'
		);
	const { invalidateAll, ...rest } = options;
	return { ...rest, refreshAll: rest.refreshAll ?? invalidateAll };
}

function wrap(callback: unknown): unknown {
	if (typeof callback !== 'function') return callback;
	return (submission: Submission) =>
		(callback as Callback)({
			...submission,
			update: (options) => submission.update(current(options))
		});
}

export function enhance(
	form: HTMLFormElement,
	submit: (input: unknown) => unknown = () => {}
): ReturnType<typeof enhanceForm> {
	return enhanceForm(form, ((input: unknown) => {
		const callback = submit(input);
		return callback instanceof Promise ? callback.then(wrap) : wrap(callback);
	}) as SubmitFunction);
}
