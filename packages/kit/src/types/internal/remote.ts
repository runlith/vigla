import type { RemoteForm } from '../remote-form.ts';
import type { RemoteLiveQuery, RemoteQuery } from '../remote.ts';
import type { MaybePromise } from '../value.ts';
import type { RequestStore } from './server.ts';

export interface RemoteNode {
	v?: any;
	e?: App.Error;
}
export interface RemoteData {
	_?: any;
	q?: Record<string, RemoteNode>;
	l?: Record<string, RemoteNode>;
	p?: Record<string, RemoteNode>;
	f?: Record<string, RemoteNode>;
	i?: string[];
	r?: boolean;
	redirect?: string;
}
export type RemoteResponse =
	| { type: 'result'; data: string | null }
	| { type: 'error'; error: App.Error }
	| { type: 'redirect'; location: string };
export type RemoteLiveResponse =
	| { type: 'result'; result: string }
	| { type: 'error'; error: App.Error }
	| { type: 'redirect'; location: string };
export interface BinaryFormMeta {
	remote_refreshes?: string[];
	validate_only?: boolean;
}
export interface InternalFormIssue {
	name: string;
	path: Array<string | number>;
	message: string;
	server?: boolean;
}
export interface RemoteFormResult {
	submission?: boolean;
	input?: Record<string, any>;
	issues?: InternalFormIssue[];
	result?: any;
}

export type RemoteValidator = (arg: any) => MaybePromise<any>;
export type RemoteImplementation = (...args: any[]) => any;
interface BaseInternals {
	id: string;
	name: string;
	validate: RemoteValidator;
	implementation: RemoteImplementation;
}
export interface RemoteQueryInternals extends BaseInternals {
	type: 'query';
	bind(payload: string, arg: any): RemoteQuery<any>;
}
export interface RemoteBatchInternals extends BaseInternals {
	type: 'query_batch';
	bind(payload: string, arg: any): RemoteQuery<any>;
	run(args: any[]): Promise<RemoteBatchResult[]>;
}
export interface RemoteLiveInternals extends BaseInternals {
	type: 'query_live';
	bind(payload: string, arg: any): RemoteLiveQuery<any>;
	run(store: RequestStore, arg: any): AsyncGenerator<any>;
}
export interface RemoteCommandInternals extends BaseInternals {
	type: 'command';
}
export interface RemoteFormInternals extends BaseInternals {
	type: 'form';
	key?: string;
	fn(
		data: Record<string, any>,
		meta: BinaryFormMeta,
		formData: FormData | null
	): Promise<RemoteFormResult | InternalFormIssue[]>;
}
export interface RemotePrerenderInternals extends BaseInternals {
	type: 'prerender';
	has_arg: boolean;
	dynamic?: boolean;
	inputs?: () => MaybePromise<any[]>;
}
export type RemoteReadInternals = RemoteQueryInternals | RemoteBatchInternals | RemoteLiveInternals;
export type RemoteInternals =
	| RemoteReadInternals
	| RemoteCommandInternals
	| RemoteFormInternals
	| RemotePrerenderInternals;
export interface RemoteExport {
	readonly __: RemoteInternals;
}
export type RemoteFunction = ((arg?: any) => any) & RemoteExport;
export type RemoteFormInstance = RemoteForm<any, any> & { readonly __: RemoteFormInternals };
export type RemoteBatchResult = { type: 'result'; data: any } | { type: 'error'; error: App.Error };
export interface RemoteRefresh {
	internals: RemoteInternals;
	read(): Promise<any>;
}
export interface RemoteResolver {
	resolve(value: any): void;
	reject(error: unknown): void;
}
export interface RemoteBatchEntry {
	input(): MaybePromise<any>;
	resolvers: RemoteResolver[];
}
export interface RemoteIterator {
	subscribe(): AsyncIterableIterator<any>;
}
export interface RemoteSnapshot {
	read(): RemoteNode | Promise<RemoteNode>;
}
export interface RemoteRequestState {
	cache: Map<RemoteInternals, Map<string, Promise<any>>>;
	forms: Map<string, RemoteFormInstance>;
	formValues: Map<RemoteFormInternals, RemoteFormResult>;
	batches: Map<RemoteBatchInternals, Map<string, RemoteBatchEntry>>;
	live: Map<string, RemoteIterator>;
	explicit: Map<string, RemoteRefresh>;
	implicit: Map<string, RemoteRefresh>;
	requested: Map<string, Set<string>>;
	ignored: Set<string>;
	hydration: Set<string>;
	snapshots: Map<string, RemoteSnapshot>;
	query: boolean;
	prerender: boolean;
	mutation: boolean;
}
