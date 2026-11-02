import { DEV } from 'esm-env';
import type { Format } from './format.ts';

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
	unhandled?(error: unknown): void;
}

const none: Values = {};

const native: Reporter = {
	warn({ code, message, dev }) {
		console.warn(dev ? `${code}: ${message}` : code);
	},
	error({ code, message, dev }) {
		const error = new Error(dev ? `${code}\n${message}` : code);
		error.name = 'Vigla error';
		return error;
	}
};

let realm: Reporter = native;
const fronts = new Map<string, Reporter>();
let speaking: () => Format | null = () => null;

export function setReporter(next: Reporter, front?: Format): void {
	if (front === undefined) realm = next;
	else fronts.set(front.global, next);
}

export function locateFront(locate: () => Format | null): void {
	speaking = locate;
}

function reporterOf(front: Format | null): Reporter {
	return front === null ? realm : (fronts.get(front.global) ?? native);
}

export function warn(code: string, message: string, values: Values = none): void {
	reporterOf(speaking()).warn({ code, message, values, dev: DEV });
}

const failures = new WeakSet<object>();

export function failure(code: string, message: string, values: Values = none): Error {
	const error = reporterOf(speaking()).error({ code, message, values, dev: DEV });
	failures.add(error);
	return error;
}

export function isFailure(error: unknown): boolean {
	return typeof error === 'object' && error !== null && failures.has(error);
}

export function formatFrame(frame: string): string | null {
	const reporter = reporterOf(speaking());
	return reporter.formatFrame === undefined ? frame : reporter.formatFrame(frame);
}

export function unhandled(front: Format | null, error: unknown): void {
	const reporter = reporterOf(front);
	if (reporter.unhandled !== undefined) {
		reporter.unhandled(error);
		return;
	}
	const host = globalThis as { reportError?: (error: unknown) => void };
	if (typeof host.reportError === 'function') host.reportError(error);
	else
		queueMicrotask(() => {
			throw error;
		});
}
