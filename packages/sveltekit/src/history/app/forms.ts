import { DEV } from 'esm-env';
import { enhance as enhanceForm, type FormUpdateOptions, type SubmitFunction } from '$app/forms';
import { warnDiagnostic } from '../diagnostics.ts';

export * from '$app/forms';

interface Submission {
	update(options?: FormUpdateOptions): Promise<void>;
}

type Callback = (submission: Submission) => unknown;

function current(options?: FormUpdateOptions): FormUpdateOptions | undefined {
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

export function enhance<
	Success extends Record<string, unknown> | undefined,
	Failure extends Record<string, unknown> | undefined
>(
	form: HTMLFormElement,
	submit: SubmitFunction<Success, Failure> = () => {}
): ReturnType<typeof enhanceForm> {
	return enhanceForm<Success, Failure>(form, (async (input) =>
		wrap(await submit(input))) as SubmitFunction<Success, Failure>);
}
