import { onDestroy } from 'vigla';

import type {
	AfterNavigate,
	BeforeNavigate,
	GotoOptions,
	Invalidation,
	NavigationCallback,
	SnapshotOptions
} from '../types/navigation.ts';
import { client } from './client.ts';
import { hash } from '../shared/hash.ts';
import {
	navigation_before_start,
	scroll_handling_outside_navigation,
	snapshot_id_missing
} from './errors.ts';

export function goto(url: string | URL, options?: GotoOptions): Promise<void> {
	return client('goto').goto(url, options);
}
export function beforeNavigate(callback: (navigation: BeforeNavigate) => void): void {
	client('beforeNavigate').lifecycle.before(callback);
}
export function onNavigate(callback: NavigationCallback): void {
	client('onNavigate').lifecycle.on(callback);
}
export function afterNavigate(callback: (navigation: AfterNavigate) => void): void {
	client('afterNavigate').lifecycle.after(callback);
}
export function invalidate(value: Invalidation, keepState = false): Promise<void> {
	return client('invalidate').invalidate(value, keepState);
}
export function invalidateAll(): Promise<void> {
	return client('invalidateAll').invalidate();
}
export function refreshAll(): Promise<void> {
	return client('refreshAll').invalidate(undefined, true);
}
export function preloadCode(id: string): Promise<void> {
	const runtime = client('preloadCode');
	return runtime.owner.run(() => runtime.routes.preload(id));
}
export function preloadData(
	url: string | URL
): ReturnType<ReturnType<typeof client>['preloadData']> {
	return client('preloadData').preloadData(url);
}
export function disableScrollHandling(): void {
	const runtime = client('disableScrollHandling');
	if (!runtime.updating) scroll_handling_outside_navigation();
	runtime.restoration.disableScroll();
}
export function pushState(url: string | URL, state: App.PageState): Promise<void> {
	const runtime = client('pushState');
	if (!runtime.started) navigation_before_start({ caller: 'pushState' });
	return runtime.shallow(url, state, false);
}
export function replaceState(url: string | URL, state: App.PageState): Promise<void> {
	const runtime = client('replaceState');
	if (!runtime.started) navigation_before_start({ caller: 'replaceState' });
	return runtime.shallow(url, state, true);
}
export function snapshot<T>(options: SnapshotOptions<T>): void {
	const runtime = client('snapshot');
	let id = options.id;
	if (id === undefined) {
		const limit = Error.stackTraceLimit;
		if (typeof limit === 'number' && limit < 3) Error.stackTraceLimit = 3;
		const frames = new Error().stack?.split('\n');
		Error.stackTraceLimit = limit;
		const frame = frames?.[0]?.trim() === 'Error' ? frames[2] : frames?.[1];
		if (!frame) snapshot_id_missing();
		id = hash(frame.replace(/\?[^)\s]*(?=:\d+:\d+\)?$)/, ''));
	}
	onDestroy(
		runtime.restoration.register(id, options, runtime.updating ? null : runtime.history.index)
	);
}
