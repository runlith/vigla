declare namespace App {
	interface Error {
		status: number;
		message: string;
	}
	interface Locals {}
	interface PageData {}
	interface PageState {}
	interface Platform {}
}

declare module '$app/types' {
	export interface AppTypes {
		PageRouteId(): string;
		EndpointRouteId(): string;
		RouteId(): string;
		RouteParams(): Record<string, Record<string, string>>;
		LayoutParams(): Record<string, Record<string, string>>;
		Path(): string;
		ResolvedPathname(): string;
		AssetPath(): string;
	}
	export type PageRouteId = ReturnType<AppTypes['PageRouteId']>;
	export type EndpointRouteId = ReturnType<AppTypes['EndpointRouteId']>;
	export type RouteId = ReturnType<AppTypes['RouteId']>;
	export type RouteIdWithSearchOrHash = RouteId | `${RouteId}?${string}` | `${RouteId}#${string}`;
	export type RouteParams<Id extends RouteId> = Id extends keyof ReturnType<AppTypes['RouteParams']>
		? ReturnType<AppTypes['RouteParams']>[Id]
		: Record<string, never>;
	export type LayoutParams<Id extends keyof ReturnType<AppTypes['LayoutParams']>> = ReturnType<
		AppTypes['LayoutParams']
	>[Id];
	export type Path = ReturnType<AppTypes['Path']>;
	export type PathnameWithSearchOrHash = Path | `${Path}?${string}` | `${Path}#${string}`;
	export type ResolvedPathname = ReturnType<AppTypes['ResolvedPathname']>;
	export type AssetPath = ReturnType<AppTypes['AssetPath']>;
}

declare module '$app/env' {
	export const browser: boolean;
	export const dev: boolean;
	export const building: boolean;
	export const version: string;
}

declare module '$app/forms' {
	import type { ActionResult, Enhancement, SubmitFunction } from '#types/forms';
	export type { ActionResult, SubmitFunction } from '#types/forms';
	export function enhance<
		Success extends Record<string, unknown> | undefined,
		Failure extends Record<string, unknown> | undefined
	>(element: HTMLFormElement, submit?: SubmitFunction<Success, Failure>): Enhancement;
	export function applyAction<
		Success extends Record<string, unknown> | undefined,
		Failure extends Record<string, unknown> | undefined
	>(result: ActionResult<Success, Failure>): Promise<void>;
	export function deserialize<
		Success extends Record<string, unknown> | undefined,
		Failure extends Record<string, unknown> | undefined
	>(result: string): ActionResult<Success, Failure>;
}

declare module '$app/navigation' {
	import type {
		AfterNavigate,
		BeforeNavigate,
		GotoOptions,
		Invalidation,
		NavigationCallback,
		PreloadResult,
		SnapshotOptions
	} from '#types/navigation';
	import type { RouteId } from '$app/types';
	export type {
		AfterNavigate,
		BeforeNavigate,
		GotoOptions,
		Navigation,
		NavigationBase,
		NavigationEnter,
		NavigationExternal,
		NavigationFormSubmit,
		NavigationGoto,
		NavigationLeave,
		NavigationLink,
		NavigationPopState,
		NavigationTarget,
		NavigationType,
		OnNavigate
	} from '#types/navigation';
	export function snapshot<T>(options: SnapshotOptions<T>): void;
	export function afterNavigate(callback: (navigation: AfterNavigate) => void): void;
	export function beforeNavigate(callback: (navigation: BeforeNavigate) => void): void;
	export function onNavigate(callback: NavigationCallback): void;
	export function disableScrollHandling(): void;
	export function goto(url: string | URL, options?: GotoOptions): Promise<void>;
	export function invalidate(resource: Invalidation, keepState?: boolean): Promise<void>;
	export function invalidateAll(): Promise<void>;
	export function refreshAll(): Promise<void>;
	export function preloadData(href: string): Promise<PreloadResult>;
	export function preloadCode(id: RouteId): Promise<void>;
	export function pushState(url: string | URL, state: App.PageState): Promise<void>;
	export function replaceState(url: string | URL, state: App.PageState): Promise<void>;
}

declare module '$app/paths' {
	import type {
		AssetPath,
		PathnameWithSearchOrHash,
		ResolvedPathname,
		RouteIdWithSearchOrHash
	} from '$app/types';
	import type { ResolveArgs, RouteMatch } from '#types/paths';
	export function asset(file: AssetPath): string;
	export function resolve<T extends RouteIdWithSearchOrHash | PathnameWithSearchOrHash>(
		...args: ResolveArgs<T>
	): ResolvedPathname;
	export function match(url: URL | string): Promise<RouteMatch | null>;
}

declare module '$app/server' {
	import type { Command, Form, Prerender, Query, Requested } from '#types/remote-functions';
	import type { RequestEvent } from '#types/request';
	export type {
		RemoteFormField,
		RemoteFormFields,
		RemoteFormFieldType,
		RemoteFormFieldValue,
		RemoteFormInput,
		RemoteFormInvalidField,
		RemoteFormIssue
	} from '#types/fields';
	export type {
		RemoteForm,
		RemoteFormEnhanceCallback,
		RemoteFormEnhanceInstance
	} from '#types/remote-form';
	export type {
		RemoteCommand,
		RemoteLiveQuery,
		RemoteLiveQueryFunction,
		RemoteLiveQueryRequestedEntry,
		RemoteLiveQueryRequestedResult,
		RemotePrerenderFunction,
		RemoteQuery,
		RemoteQueryFunction,
		RemoteQueryOverride,
		RemoteQueryRequestedResult,
		RemoteQueryUpdate,
		RemoteResource,
		RequestedEntry,
		RequestedResult
	} from '#types/remote';
	export function read(asset: string): Response;
	export function getRequestEvent(): RequestEvent;
	export function getRequestOwner(): import('vigla').Owner;
	export const command: Command;
	export const form: Form;
	export const prerender: Prerender;
	export const query: Query;
	export const requested: Requested;
}

declare module '$app/service-worker' {
	// @ts-ignore
	export const self: ServiceWorkerGlobalScope;
}

declare module '$app/state' {
	import type { IdleNavigation, Navigation } from '#types/navigation';
	import type { Page, Updated } from '#types/state';
	export type { Page, ReadonlyURL, ReadonlyURLSearchParams } from '#types/state';
	export const page: Page;
	export const navigating: Navigation | IdleNavigation;
	export const updated: Updated;
}

declare module '$app/manifest' {
	import type { AssetPath, Path } from '$app/types';
	import type { ManifestPath, ManifestRoute } from '#types/paths';
	export type { ManifestRoute } from '#types/paths';
	export const immutable: ManifestPath[];
	export const assets: ManifestPath<AssetPath>[];
	export const prerendered: ManifestPath<Path>[];
	export const routes: ManifestRoute[];
}
