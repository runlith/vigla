import type { CaughtError } from '../types/hooks.ts';
import type { RequestStore } from '../types/internal/server.ts';
import { HttpError, ValidationError } from '../shared/outcomes.ts';
import type { Server } from './index.ts';
import { runRequest } from './scope.ts';
import { appEvent } from './hooks.ts';
import * as errors from './errors.ts';

export class FrameworkError extends Error {
	readonly status: number;
	readonly text: string;
	constructor(status: number, text: string, detail = text) {
		super(detail);
		this.status = status;
		this.text = text;
	}
}

export async function handleError(
	server: Server,
	store: RequestStore,
	error: unknown
): Promise<App.Error> {
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
			server.options.fixStack?.(current);
			current = current.cause;
		}
	}
	const fallback =
		caught.kind === 'unknown' ? { status: 500, message: 'Internal Error' } : caught.error;
	try {
		if (!server.hooks.handleError) {
			if (caught.kind === 'unknown') console.error(error);
			return fallback as App.Error;
		}
		const result = await runRequest(
			store,
			() => server.hooks.handleError!({ ...caught, event: appEvent(store.event) }),
			server.scope
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
