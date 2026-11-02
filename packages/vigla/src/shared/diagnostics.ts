import { DEV } from 'esm-env';

export type Values = Readonly<Record<string, string>>;

export interface Reporter {
	warn(code: string, message: string | null, values?: Values): void;
	error(code: string, message: string | null, values?: Values): Error;
	formatFrame?(frame: string): string | null;
}

const none: Values = {};

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

export function warn(code: string, message: string, values: Values = none): void {
	reporter.warn(code, DEV ? message : null, values);
}

const failures = new WeakSet<object>();

export function failure(code: string, message: string, values: Values = none): Error {
	const error = reporter.error(code, DEV ? message : null, values);
	failures.add(error);
	return error;
}

export function isFailure(error: unknown): boolean {
	return typeof error === 'object' && error !== null && failures.has(error);
}

export function formatFrame(frame: string): string | null {
	return reporter.formatFrame === undefined ? frame : reporter.formatFrame(frame);
}
