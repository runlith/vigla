import type {
	AfterNavigate,
	BeforeNavigate,
	GotoOptions,
	Invalidation,
	NavigationCallback,
	SnapshotOptions
} from '../../../types/navigation.ts';
import { server_api_unavailable } from '../../../server/errors.ts';

export function afterNavigate(_callback: (navigation: AfterNavigate) => void): void {}
export function beforeNavigate(_callback: (navigation: BeforeNavigate) => void): void {}
export function onNavigate(_callback: NavigationCallback): void {}
export function snapshot<T>(_options: SnapshotOptions<T>): void {}
export function disableScrollHandling(): never {
	return server_api_unavailable({ name: 'disableScrollHandling' });
}
export function goto(_url: string | URL, _options?: GotoOptions): never {
	return server_api_unavailable({ name: 'goto' });
}
export function invalidate(_resource: Invalidation, _keepState?: boolean): never {
	return server_api_unavailable({ name: 'invalidate' });
}
export function invalidateAll(): never {
	return server_api_unavailable({ name: 'invalidateAll' });
}
export function refreshAll(): never {
	return server_api_unavailable({ name: 'refreshAll' });
}
export function preloadCode(_id: string): never {
	return server_api_unavailable({ name: 'preloadCode' });
}
export function preloadData(_href: string): never {
	return server_api_unavailable({ name: 'preloadData' });
}
