declare module '~upstream-utils' {
	export const e2eServer: { logs: { watch: { out: string[] } } };
	export const hmrUpdateTimeout: number;
	export const page: { reload(): Promise<unknown> };
	export function editFile(file: string, replacer: (content: string) => string): string | undefined;
	export function saveScreenshot(name: string): Promise<void>;
}
