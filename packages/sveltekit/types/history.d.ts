declare module '$app/navigation' {
	export function goto(
		url: string | URL,
		options?: import('$app/navigation').GotoOptions & {
			replaceState?: boolean;
			invalidateAll?: boolean;
		}
	): Promise<void>;
}
