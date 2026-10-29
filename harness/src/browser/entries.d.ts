declare module '*/props.svelte.js' {
	export function reactive<T extends Record<string, unknown>>(value: T): T;
}
