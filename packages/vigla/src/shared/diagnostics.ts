import { DEV } from 'esm-env';

export interface Reporter {
	warn(code: string, message: string | null): void;
	error(code: string, message: string | null): Error;
	formatFrame?(frame: string): string;
}

let reporter: Reporter = {
	warn(code, message) {
		console.warn(message === null ? code : `${code}: ${message}`);
	},
	error(code, message) {
		const error = new Error(message === null ? code : `${code}\n${message}`);
		error.name = 'Vigla error';
		return error;
	}
};

export function setReporter(next: Reporter): void {
	reporter = next;
}

export function warn(code: string, message: string): void {
	reporter.warn(code, DEV ? message : null);
}

const failures = new WeakSet<object>();

export function failure(code: string, message: string): Error {
	const error = reporter.error(code, DEV ? message : null);
	failures.add(error);
	return error;
}

export function isFailure(error: unknown): boolean {
	return typeof error === 'object' && error !== null && failures.has(error);
}

export function formatFrame(frame: string): string {
	return reporter.formatFrame?.(frame) ?? frame;
}
