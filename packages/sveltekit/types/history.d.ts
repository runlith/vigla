declare module '$app/navigation' {
	export interface GotoOptions {
		replaceState?: boolean;
		invalidateAll?: boolean;
	}
	export function pushState(url: string | URL, state: App.PageState): Promise<void>;
	export function replaceState(url: string | URL, state: App.PageState): Promise<void>;
}

declare module '$app/forms' {
	export interface FormUpdateOptions {
		invalidateAll?: boolean;
	}
}
