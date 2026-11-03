/// <reference path="../../types/index.d.ts" preserve="true" />
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { ErrorBody, ErrorReturn } from './outcomes.ts';
import type { NavigationEvent, RequestEvent } from './request.ts';
import type { MaybePromise } from './value.ts';

export interface PageChunk {
	html: string;
	done: boolean;
}
export type PreloadFile =
	| { type: 'css' | 'js' | 'asset'; path: string }
	| { type: 'font'; path: string; filename: string };
export interface ResolveOptions {
	transformPageChunk?: (chunk: PageChunk) => MaybePromise<string | undefined>;
	filterSerializedResponseHeaders?: (name: string, value: string) => boolean;
	preload?: (file: PreloadFile) => boolean;
}
export type Resolve = (event: RequestEvent, options?: ResolveOptions) => Promise<Response>;
export interface HandleInput {
	event: RequestEvent;
	resolve: Resolve;
}
export type Handle = (input: HandleInput) => MaybePromise<Response>;
type ErrorKinds = { app: App.Error; framework: ErrorBody; unknown: unknown };
export type CaughtError<Issue extends StandardSchemaV1.Issue = StandardSchemaV1.Issue> =
	| {
			[K in keyof ErrorKinds]: { kind: K; error: ErrorKinds[K]; issues?: undefined };
	  }[keyof ErrorKinds]
	| { kind: 'validation'; error: ErrorBody; issues: Issue[] };
export type ClientCaughtError = Exclude<CaughtError, { kind: 'validation' }>;
export type HandleServerError<Issue extends StandardSchemaV1.Issue = StandardSchemaV1.Issue> = (
	input: CaughtError<Issue> & { event: RequestEvent }
) => MaybePromise<ErrorReturn>;
export type HandleClientError = (
	input: ClientCaughtError & { event: NavigationEvent }
) => MaybePromise<ErrorReturn>;
export interface FetchInput {
	event: RequestEvent;
	request: Request;
	fetch: typeof fetch;
}
export type HandleFetch = (input: FetchInput) => MaybePromise<Response>;
export type ServerInit = () => MaybePromise<void>;
export type ClientInit = () => MaybePromise<void>;
export interface RerouteEvent {
	url: URL;
	fetch: typeof fetch;
}
export type Reroute = (event: RerouteEvent) => MaybePromise<void | string>;
export interface Transporter<T = any, Encoded = any> {
	encode(value: T): false | Encoded;
	decode(value: Encoded): T;
}
export type Transport = Record<string, Transporter>;
export declare function sequence(...handlers: Handle[]): Handle;
