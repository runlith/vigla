import type { LayoutParams, RouteId } from '$app/types';
import type { Route, Snapshot } from './request.ts';
import type { MaybePromise } from './value.ts';
import type { ParamValue } from './params.ts';

export interface ScrollPosition {
	x: number;
	y: number;
}
export interface NavigationTarget<
	Params extends Record<string, ParamValue> = LayoutParams<'/'>,
	Id extends RouteId | null = RouteId | null
> {
	params: Params | null;
	route: Route<Id | null>;
	url: URL;
	scroll: ScrollPosition | null;
}
export type Invalidation = string | URL | ((url: URL) => boolean);
export interface GotoOptions {
	replace?: boolean;
	replaceState?: boolean;
	shallow?: boolean;
	reset?: boolean;
	refreshAll?: boolean;
	invalidate?: Invalidation[];
	invalidateAll?: boolean;
	state?: App.PageState;
	persistState?: boolean;
}
export type NavigationType = 'enter' | 'form' | 'leave' | 'link' | 'goto' | 'popstate';
export interface NavigationBase {
	type: NavigationType;
	shallow: boolean;
	from: NavigationTarget | null;
	to: NavigationTarget | null;
	willUnload: boolean;
	complete: Promise<void>;
}
export interface NavigationEnter extends NavigationBase {
	type: 'enter';
	delta?: undefined;
	event?: undefined;
}
export interface NavigationGoto extends NavigationBase {
	type: 'goto';
}
export interface NavigationLeave extends NavigationBase {
	type: 'leave';
}
export interface NavigationFormSubmit extends NavigationBase {
	type: 'form';
	event: SubmitEvent;
}
export interface NavigationPopState extends NavigationBase {
	type: 'popstate';
	delta: number;
	event: PopStateEvent;
}
export interface NavigationLink extends NavigationBase {
	type: 'link';
	event: PointerEvent;
}
export type NavigationExternal = NavigationGoto | NavigationLeave;
export type Navigation =
	| NavigationExternal
	| NavigationFormSubmit
	| NavigationPopState
	| NavigationLink;
export type BeforeNavigate = Navigation & { cancel(): void };
export type OnNavigate = Navigation & {
	type: Exclude<NavigationType, 'enter' | 'leave'>;
	willUnload: false;
};
export type AfterNavigate = (Navigation | NavigationEnter) & {
	type: Exclude<NavigationType, 'leave'>;
	willUnload: false;
};
export interface SnapshotOptions<T> extends Snapshot<T> {
	id?: string;
	reset?: () => void;
}
export type PreloadResult = (
	| { type: 'loaded'; data: Record<string, any> }
	| { type: 'redirect'; location: string }
	| { type: 'error'; error: App.Error }
) & { status: number };
export interface IdleNavigation {
	from: null;
	to: null;
	type: null;
	willUnload: null;
	delta: null;
	complete: null;
}
export type NavigationCallback = (navigation: OnNavigate) => MaybePromise<(() => void) | void>;
