import { shallow } from '@vigla/kit/internal/shallow';

export * from '$app/navigation';

export function pushState(url: string | URL, state: App.PageState): never {
	return shallow('pushState', url, state);
}

export function replaceState(url: string | URL, state: App.PageState): never {
	return shallow('replaceState', url, state);
}
