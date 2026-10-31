import type { MaybePromise } from './value.ts';

export type RemoteResource<T> = Promise<T> & {
	readonly error: App.Error | undefined;
	readonly loading: boolean;
} & ({ readonly current: undefined; ready: false } | { readonly current: T; ready: true });
export type RemoteQuery<T> = RemoteResource<T> & {
	set(value: T): void;
	refresh(): Promise<void>;
	withOverride(update: (value: T) => T): RemoteQueryOverride;
};
export type RemoteLiveQuery<T> = RemoteResource<T> &
	AsyncIterable<T> & {
		readonly connected: boolean;
		readonly done: boolean;
		reconnect(): Promise<void>;
	};
export type RemoteQueryOverride = () => void;
export type RemoteQueryUpdate =
	| RemoteQuery<any>
	| RemoteLiveQuery<any>
	| RemoteQueryFunction<any, any>
	| RemoteLiveQueryFunction<any, any>
	| RemoteQueryOverride;
export interface UpdatingPromise<Output> extends Promise<Output> {
	updates(...updates: RemoteQueryUpdate[]): Promise<Output>;
}
export interface RemoteCommand<Input, Output> {
	(arg: undefined extends Input ? Input | void : Input): UpdatingPromise<Output>;
	readonly pending: number;
}
export type RemotePrerenderFunction<Input, Output> = (
	arg: undefined extends Input ? Input | void : Input
) => RemoteResource<Output>;
declare const validated: unique symbol;
export type RemoteQueryFunction<Input, Output, Validated = Input> = ((
	arg: undefined extends Input ? Input | void : Input
) => RemoteQuery<Output>) & { readonly [validated]?: Validated };
export type RemoteLiveQueryFunction<Input, Output, Validated = Input> = ((
	arg: undefined extends Input ? Input | void : Input
) => RemoteLiveQuery<Output>) & { readonly [validated]?: Validated };
export interface RequestedEntry<Validated, Output> {
	arg: Validated;
	query: RemoteQuery<Output>;
	ignore(): void;
}
export interface RemoteLiveQueryRequestedEntry<Validated, Output> {
	arg: Validated;
	query: RemoteLiveQuery<Output>;
	ignore(): void;
}
export interface RemoteQueryRequestedResult<Validated, Output>
	extends
		Iterable<RequestedEntry<Validated, Output>>,
		AsyncIterable<RequestedEntry<Validated, Output>> {
	refreshAll(): Promise<void>;
	ignoreAll(): Promise<void>;
}
export interface RemoteLiveQueryRequestedResult<Validated, Output>
	extends
		Iterable<RemoteLiveQueryRequestedEntry<Validated, Output>>,
		AsyncIterable<RemoteLiveQueryRequestedEntry<Validated, Output>> {
	reconnectAll(): Promise<void>;
	ignoreAll(): Promise<void>;
}
export type RequestedResult<Validated, Output> =
	| RemoteQueryRequestedResult<Validated, Output>
	| RemoteLiveQueryRequestedResult<Validated, Output>;
export type LiveResult<T> = MaybePromise<
	AsyncGenerator<T> | AsyncIterator<T> | AsyncIterable<T> | Generator<T> | Iterator<T> | Iterable<T>
>;
export interface PrerenderOptions<Input> {
	inputs?: () => MaybePromise<Input[]>;
	dynamic?: boolean;
}
