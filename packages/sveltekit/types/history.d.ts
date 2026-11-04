declare module '$app/navigation' {
	export function goto(
		url: string | URL,
		options?: import('$app/navigation').GotoOptions & {
			replaceState?: boolean;
			invalidateAll?: boolean;
		}
	): Promise<void>;
	export function pushState(url: string | URL, state: App.PageState): Promise<void>;
	export function replaceState(url: string | URL, state: App.PageState): Promise<void>;
}
