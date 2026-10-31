import type { StandardSchemaV1 as Schema } from '@standard-schema/spec';
import type { RemoteFormInput, RemoteFormInvalidField } from './fields.ts';
import type { RemoteForm } from './remote-form.ts';
import type {
	LiveResult,
	PrerenderOptions,
	RemoteCommand,
	RemoteLiveQueryFunction,
	RemoteLiveQueryRequestedResult,
	RemotePrerenderFunction,
	RemoteQueryFunction,
	RemoteQueryRequestedResult
} from './remote.ts';
import type { IsAny, MaybePromise } from './value.ts';

export interface Command {
	<Output>(fn: () => MaybePromise<Output>): RemoteCommand<void, Output>;
	<Input, Output>(
		validation: 'unchecked',
		fn: (arg: Input) => MaybePromise<Output>
	): RemoteCommand<Input, Output>;
	<S extends Schema, Output>(
		validation: S,
		fn: (arg: Schema.InferOutput<S>) => MaybePromise<Output>
	): RemoteCommand<Schema.InferInput<S>, Output>;
}
export interface Query {
	<Output>(fn: () => MaybePromise<Output>): RemoteQueryFunction<void, Output>;
	<Input, Output>(
		validation: 'unchecked',
		fn: (arg: Input) => MaybePromise<Output>
	): RemoteQueryFunction<Input, Output>;
	<S extends Schema, Output>(
		validation: S,
		fn: (arg: Schema.InferOutput<S>) => MaybePromise<Output>
	): RemoteQueryFunction<Schema.InferInput<S>, Output, Schema.InferOutput<S>>;
	batch: BatchQuery;
	live: LiveQuery;
}
export interface BatchQuery {
	<Input, Output>(
		validation: 'unchecked',
		fn: (args: Input[]) => MaybePromise<(arg: Input, index: number) => Output>
	): RemoteQueryFunction<Input, Output>;
	<S extends Schema, Output>(
		validation: S,
		fn: (
			args: Schema.InferOutput<S>[]
		) => MaybePromise<(arg: Schema.InferOutput<S>, index: number) => Output>
	): RemoteQueryFunction<Schema.InferInput<S>, Output, Schema.InferOutput<S>>;
}
export interface LiveQuery {
	<Output>(fn: (arg: void) => LiveResult<Output>): RemoteLiveQueryFunction<void, Output>;
	<Input, Output>(
		validation: 'unchecked',
		fn: (arg: Input) => LiveResult<Output>
	): RemoteLiveQueryFunction<Input, Output>;
	<S extends Schema, Output>(
		validation: S,
		fn: (arg: Schema.InferOutput<S>) => LiveResult<Output>
	): RemoteLiveQueryFunction<Schema.InferInput<S>, Output, Schema.InferOutput<S>>;
}
export interface Prerender {
	<Output>(
		fn: () => MaybePromise<Output>,
		options?: PrerenderOptions<void>
	): RemotePrerenderFunction<void, Output>;
	<Input, Output>(
		validation: 'unchecked',
		fn: (arg: Input) => MaybePromise<Output>,
		options?: PrerenderOptions<Input>
	): RemotePrerenderFunction<Input, Output>;
	<S extends Schema, Output>(
		validation: S,
		fn: (arg: Schema.InferOutput<S>) => MaybePromise<Output>,
		options?: PrerenderOptions<Schema.InferInput<S>>
	): RemotePrerenderFunction<Schema.InferInput<S>, Output>;
}
export type RequiredBoolean<T> =
	IsAny<T> extends true
		? never
		: [T] extends [boolean]
			? true
			: T extends Array<infer Element>
				? RequiredBoolean<Element>
				: T extends Record<string, any>
					? { [K in keyof T]: RequiredBoolean<T[K]> }[keyof T]
					: never;
export interface Form {
	<Output>(fn: () => MaybePromise<Output>): RemoteForm<void, Output>;
	<Input extends RemoteFormInput, Output>(
		validation: 'unchecked',
		fn: (input: Input, issue: RemoteFormInvalidField<Input>) => MaybePromise<Output>
	): RemoteForm<Input, Output>;
	<S extends Schema<RemoteFormInput, Record<string, any>>, Output>(
		validation: true extends RequiredBoolean<Schema.InferInput<S>>
			? 'Error: All booleans in form schemas must be optional (e.g. `v.optional(v.boolean(), false)`) because checkbox inputs do not send a false value when unchecked.'
			: S,
		fn: (
			input: Schema.InferOutput<S>,
			issue: RemoteFormInvalidField<Schema.InferInput<S>>
		) => MaybePromise<Output>
	): RemoteForm<Schema.InferInput<S>, Output>;
}
export interface Requested {
	<Input, Output, Validated = Input>(
		query: RemoteQueryFunction<Input, Output, Validated>,
		limit: number
	): RemoteQueryRequestedResult<Validated, Output>;
	<Input, Output, Validated = Input>(
		query: RemoteLiveQueryFunction<Input, Output, Validated>,
		limit: number
	): RemoteLiveQueryRequestedResult<Validated, Output>;
}
