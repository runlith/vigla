import { DEV } from 'esm-env';
import { warnDiagnostic } from '../diagnostics.ts';

interface ErrorInput {
	kind: string;
	error: unknown;
}

interface Fallback {
	status: number;
	message: string;
}

type HandleError = (input: ErrorInput) => unknown;

export function retiredProperties(handle: HandleError | undefined): HandleError | undefined {
	if (!DEV || !handle) return handle;
	return (input) => {
		const fallback: Fallback =
			input.kind === 'unknown'
				? { status: 500, message: 'Internal Error' }
				: (input.error as Fallback);
		Object.defineProperties(input, {
			status: {
				get() {
					warnDiagnostic(
						'handle_error_status_deprecated',
						'The `status` property of `handleError` is deprecated. Use `error.status` for expected and framework errors, or `500` for unexpected errors.'
					);
					return fallback.status;
				}
			},
			message: {
				get() {
					warnDiagnostic(
						'handle_error_message_deprecated',
						"The `message` property of `handleError` is deprecated. Use `error.message` for expected and framework errors, or `'Internal Error'` for unexpected errors."
					);
					return fallback.message;
				}
			}
		});
		return handle(input);
	};
}
