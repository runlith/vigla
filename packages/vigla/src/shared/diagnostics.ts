import { DEV } from 'esm-env';

export type Values = Readonly<Record<string, string>>;

export interface Notice {
	readonly code: string;
	readonly message: string;
	readonly values: Values;
	readonly dev: boolean;
}

export interface Reporter {
	warn(notice: Notice): void;
	error(notice: Notice): Error;
	formatFrame?(frame: string): string | null;
}

const none: Values = {};

let reporter: Reporter = {
	warn({ code, message, dev }) {
		console.warn(dev ? `${code}: ${message}` : code);
	},
	error({ code, message, dev }) {
		const error = new Error(dev ? `${code}\n${message}` : code);
		error.name = 'Vigla error';
		return error;
	}
};

export function setReporter(next: Reporter): void {
	reporter = next;
}

export function warn(code: string, message: string, values: Values = none): void {
	reporter.warn({ code, message, values, dev: DEV });
}

const failures = new WeakSet<object>();

export function failure(code: string, message: string, values: Values = none): Error {
	const error = reporter.error({ code, message, values, dev: DEV });
	failures.add(error);
	return error;
}

export function isFailure(error: unknown): boolean {
	return typeof error === 'object' && error !== null && failures.has(error);
}

export function formatFrame(frame: string): string | null {
	return reporter.formatFrame === undefined ? frame : reporter.formatFrame(frame);
}
