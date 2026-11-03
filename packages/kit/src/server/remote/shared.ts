import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { RemoteImplementation, RemoteValidator } from '../../types/internal/remote.ts';
import type { RequestStore } from '../../types/internal/server.ts';
import type { MaybePromise } from '../../types/value.ts';
import { HttpError, ValidationError } from '../../shared/outcomes.ts';
import { runRequest } from '../scope.ts';
import * as errors from './errors.ts';

export interface Execution {
	query?: boolean;
	prerender?: boolean;
	mutation?: boolean;
}

export function createValidator(
	validation: any,
	implementation?: RemoteImplementation
): RemoteValidator {
	if (!implementation)
		return (arg) => {
			if (arg !== undefined) throw new HttpError({ status: 400, message: 'Bad Request' });
		};
	if (validation === 'unchecked') return (arg) => arg;
	if (!validation || !('~standard' in validation)) return errors.invalidValidator();
	const schema = validation as StandardSchemaV1;
	const result = (validated: StandardSchemaV1.Result<unknown>): unknown => {
		if (validated.issues) throw new ValidationError(validated.issues as StandardSchemaV1.Issue[]);
		return validated.value;
	};
	return (input) => {
		const validated = schema['~standard'].validate(input);
		return thenable(validated) ? Promise.resolve(validated).then(result) : result(validated);
	};
}

export function thenable(value: unknown): value is PromiseLike<any> {
	return (
		value !== null && (typeof value === 'object' || typeof value === 'function') && 'then' in value
	);
}

export function remoteStore(
	store: RequestStore,
	execution: Execution,
	allowCookies: boolean
): RequestStore {
	const original = store.event;
	const event = {
		...original,
		setHeaders: () => errors.headersForbidden(),
		cookies: {
			...original.cookies,
			set: ((name, value, options) => {
				if (!allowCookies) errors.cookieForbidden('set');
				if (options?.path && !options.path.startsWith('/')) errors.cookiePath('set');
				return original.cookies.set(name, value, options);
			}) as typeof original.cookies.set,
			delete: ((name, options) => {
				if (!allowCookies) errors.cookieForbidden('delete');
				if (options?.path && !options.path.startsWith('/')) errors.cookiePath('deleted');
				return original.cookies.delete(name, options);
			}) as typeof original.cookies.delete
		}
	};
	const remote = { ...store.remote, ...execution };
	if (remote.query)
		for (const property of ['url', 'params', 'route']) {
			Object.defineProperty(event, property, {
				get: () => errors.requestProperty(property),
				enumerable: false
			});
		}
	return { ...store, event, remote };
}

export async function execute<T>(
	store: RequestStore,
	execution: Execution,
	allowCookies: boolean,
	input: () => MaybePromise<any>,
	implementation: (arg: any) => MaybePromise<T>
): Promise<T> {
	const derived = remoteStore(store, execution, allowCookies);
	const value = await runRequest(derived, input);
	return runRequest(derived, () => implementation(value));
}

export async function* generate(
	store: RequestStore,
	input: () => MaybePromise<any>,
	implementation: RemoteImplementation,
	name: string
): AsyncGenerator<any> {
	const derived = remoteStore(store, { query: true }, false);
	const arg = await runRequest(derived, input);
	const source = await runRequest(derived, () => implementation(arg));
	const iterator: Iterator<any> | AsyncIterator<any> =
		source && typeof source.next === 'function'
			? source
			: (source?.[Symbol.asyncIterator]?.() ??
				source?.[Symbol.iterator]?.() ??
				errors.liveInvalid(name));
	let done = false;
	try {
		while (true) {
			const step = { ...derived, remote: { ...derived.remote, cache: new Map() } };
			const result = await runRequest(step, () => iterator.next());
			if (result.done) {
				done = true;
				return;
			}
			yield result.value;
		}
	} finally {
		if (!done) await runRequest(derived, () => iterator.return?.());
	}
}
