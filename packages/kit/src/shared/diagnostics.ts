export let verbose = false;

export function enableVerboseErrors(): void {
	verbose = true;
}

export function throwDiagnostic(code: string, text: string, caller: Function): never {
	const error = new Error(`${code}\n${text}\nhttps://svelte.dev/e/kit/${code}`);
	error.name = 'SvelteKit error';
	Error.captureStackTrace?.(error, caller);
	throw error;
}

export function warnDiagnostic(code: string, text: string): void {
	console.warn(
		`%c[sveltekit] ${code}\n%c${text}\nhttps://svelte.dev/e/kit/${code}`,
		'font-weight: bold',
		'font-weight: normal'
	);
}
