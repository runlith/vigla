import type { CaughtError } from '../types/hooks.ts';
import type { RequestStore } from '../types/internal/server.ts';
import { HttpError, ValidationError, FrameworkError, HandledError } from '../shared/outcomes.ts';
export { FrameworkError, HandledError } from '../shared/outcomes.ts';
import { runRequest } from './scope.ts';
import { appEvent } from './hooks.ts';
import * as errors from './errors.ts';

export async function handleError(store: RequestStore, error: unknown): Promise<App.Error> {
	if (error instanceof HandledError) return error.body;
	let caught: CaughtError;
	if (error instanceof HttpError) caught = { kind: 'app', error: error.body };
	else if (error instanceof FrameworkError)
		caught = { kind: 'framework', error: { status: error.status, message: error.text } };
	else if (error instanceof ValidationError)
		caught = {
			kind: 'validation',
			error: { status: 400, message: 'Bad Request' },
			issues: error.issues
		};
	else {
		caught = { kind: 'unknown', error };
		let current = error;
		while (current instanceof Error) {
			store.options.fixStack?.(current);
			current = current.cause;
		}
	}
	const fallback =
		caught.kind === 'unknown' ? { status: 500, message: 'Internal Error' } : caught.error;
	try {
		if (!store.hooks.handleError) {
			if (caught.kind === 'unknown') console.error(error);
			return fallback as App.Error;
		}
		const result = await runRequest(store, () =>
			store.hooks.handleError!({ ...caught, event: appEvent(store.event) })
		);
		return { ...fallback, ...result } as App.Error;
	} catch (cause) {
		try {
			errors.handle_error_hook_failed({ cause });
		} catch (failure) {
			console.error(failure);
		}
		console.error('Original error:', error);
		return { status: fallback.status, message: 'Internal Error' } as App.Error;
	}
}
